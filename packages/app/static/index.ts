/**
 * @file `@lightstart/app/static`: an app's page rendered in node, without a
 * browser. `renderApp` runs the app as `openApp` does (memory stores unless
 * `adapters`, the arguments, the controllers ready) over a history in memory at
 * a path, and mounts its root view on light's markup host, `<app-container>`
 * drawing the routes' view and `<app-slot>` the items an extension filled a
 * slot with; it answers the root element's markup with the engine's markers.
 * `renderPage` puts that markup in a built page in place of its root
 * placeholder and marks the page prerendered, as `light build --prerender`
 * does.
 *
 * Render on the markup host only after `@lightstart/light/markup` is imported:
 * it names the markup element and registry to light's views, and a view
 * module registers when it loads. Import it before the app's manifest (the
 * generated `.light/app.ts` or `.light/app.js`), which imports every view.
 */

import { MRoot, MarkupHost, serialize } from "@lightstart/light/markup";
import View from "@lightstart/light";
import { element, html, key } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { configure, currentHost, disposeTree, setHost } from "@lightstart/light/html/core.js";
import { effect } from "@lightstart/light/signals";
import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import { withBase } from "@lightstart/router/url";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { MElement } from "@lightstart/light/markup/node.js";
import { get as registeredView } from "@lightstart/light/markup/registry.js";
import { config, configureView } from "@lightstart/light/view/core.js";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppHost, AppRun, currentParams, outletAt } from "../run.ts";
import type { RunStore } from "../run.ts";
import { convertParam } from "../outlet.ts";
import type { OutletPosition } from "../outlet.ts";
import { openStores as openLocalStores } from "../engine.ts";
import { MemoryAdapterType, AdapterType } from "../stores.ts";
import { Slot } from "../slots.ts";
import { PRERENDER_SCRIPT } from "../node/prerender.ts";
import { absoluteImageOf, alternatesOf, canonicalOf, currentHead, documentTitleOf } from "../head.ts";
import type { AlternateLink, Head } from "../head.ts";

/** What a static render runs with: where the routes start, the app's arguments (an argv list or a record over the defaults), and the adapter types it runs (every store in memory when absent). */
export interface RenderOptions {
  /** The path the in-memory history starts at. */
  path?: string;
  args?: readonly string[] | Record<string, unknown>;
  /** The adapter types the stores open with, the first the default; `memory` is always available. None opens every store in memory. */
  adapters?: readonly AdapterType[];
}

interface MadePosition {
  level: number;
  kind: "layout" | "view";
}

/** Every element a container made, and the level it draws: a nested container finds its position from the nearest one above it. */
const madePositions = new WeakMap<MElement, MadePosition>();

const propTypeOf = (tag: string, key: string): string | null => {
  const constructor = registeredView(tag) as unknown as { properties?: Record<string, unknown> } | undefined;
  const properties = constructor?.properties ?? {};
  const property = properties[key];
  if (typeof property !== "object" || property === null) return null;
  const type = (property as { $type?: unknown }).$type;
  return typeof type === "string" ? type : null;
};

const positionOf = (container: StaticAppContainer): OutletPosition => {
  let node: MElement | null = (container as unknown as MElement).parentElement;
  while (node !== null) {
    const made = madePositions.get(node);
    if (made !== undefined) return made.kind === "layout" ? { level: made.level, kind: "layout" } : { level: made.level + 1, kind: "root" };
    node = node.parentElement;
  }
  return { level: 0, kind: "root" };
};

/** The view the routes answer, wrapped in its layout and its parameters set as props; drawn as the markup host's elements for the tags. */
class StaticAppContainer extends View {
  private layoutTag: string | null = null;
  private layoutElement: MElement | null = null;
  private viewTag: string | null = null;
  private viewElement: MElement | null = null;

  override render(): unknown {
    const outlet = outletAt(positionOf(this));
    const view = outlet.view;
    if (view === null) return html``;
    if (outlet.layout !== null) {
      if (outlet.layout !== this.layoutTag || this.layoutElement === null) {
        this.layoutTag = outlet.layout;
        this.layoutElement = currentHost().createElement(outlet.layout) as MElement;
        this.viewTag = null;
        this.viewElement = null;
      }
      madePositions.set(this.layoutElement, { level: outlet.level, kind: "layout" });
      return html`${this.layoutElement}`;
    }
    this.layoutTag = null;
    this.layoutElement = null;
    if (view !== this.viewTag || this.viewElement === null) {
      this.viewTag = view;
      this.viewElement = currentHost().createElement(view) as MElement;
    }
    madePositions.set(this.viewElement, { level: outlet.level, kind: "view" });
    const params = currentParams.value;
    for (const key of Object.keys(outlet.props)) {
      const value = key in params ? convertParam(params[key], propTypeOf(view, key)) : outlet.props[key];
      Reflect.set(this.viewElement, key, value);
    }
    return html`${this.viewElement}`;
  }
}

/** The tag an item names, when it names one as a string. */
const tagOf = (item: object): string | null => {
  const tag = Reflect.get(item, "tag");
  return typeof tag === "string" ? tag : null;
};

/** Every item a slot holds, each drawn by the tag it names with the slot's context and the item set on it; keyed by the item, so its element stays across a redraw. */
class StaticAppSlot extends View.props({ slot: T.object({ defaultValue: null, attribute: false }), context: T.any({ attribute: false }) }) {

  override render(): unknown {
    const slot: unknown = this.slot;
    if (!(slot instanceof Slot)) return html``;
    const children = slot.items.value.flatMap((item) => {
      const tag = tagOf(item);
      return tag === null ? [] : [key(item, element(tag, { ".context": this.context, ".item": item }))];
    });
    return html`${children}`;
  }
}

let registered = false;

const registerContainer = (): void => {
  if (registered) return;
  View.register("app-container", StaticAppContainer);
  View.register("app-slot", StaticAppSlot);
  registered = true;
};

/** A static render's host: memory stores, the given arguments, a history in memory at a path, and the root view on a markup host. */
class StaticHost extends AppHost {
  readonly name = "static";
  private readonly path: string;
  private readonly given: readonly string[] | Record<string, unknown> | undefined;
  private readonly markup = new MarkupHost();
  private previous: ReturnType<typeof currentHost> | null = null;
  private root: MRoot | null = null;
  private element: MElement | null = null;

  constructor(path: string, given: readonly string[] | Record<string, unknown> | undefined, adapters: readonly AdapterType[]) {
    super();
    this.openStores = (manifest: AppManifest, memoryOnly: boolean): Promise<RunStore> => openLocalStores(manifest, this, memoryOnly);
    this.path = path;
    this.given = given;
    this.adapters = adapters.length > 0 ? adapters : [new MemoryAdapterType()];
    this.defaultAdapter = this.adapters[0]?.name ?? "memory";
  }

  args(app: App): Record<string, unknown> {
    const given = this.given;
    if (Array.isArray(given)) return parseArgs(app.argsSchema, given) as Record<string, unknown>;
    return { ...(parseArgs(app.argsSchema, []) as Record<string, unknown>), ...(given ?? {}) };
  }

  history(): RouterAdapter {
    return createMemoryAdapter(this.path);
  }

  mount(run: AppRun): Promise<void> {
    registerContainer();
    this.previous = currentHost();
    configure({ host: this.markup, effect });
    const tag = run.app.root ?? "app-root";
    if (registeredView(tag) === undefined)
      throw new Error(`The root view "<${tag}>" is not registered on the markup host; import "@lightstart/light/markup" before the app's manifest so its views register there.`);
    this.root = new MRoot();
    this.element = this.markup.createElement(tag) as MElement;
    this.markup.insertBefore(this.root, this.element, null);
    return Promise.resolve();
  }

  unmount(_run: AppRun): void {
    const root = this.root;
    const previous = this.previous;
    this.root = null;
    this.element = null;
    this.previous = null;
    if (root !== null) {
      for (const child of [...root.childNodes]) this.markup.remove(child);
      disposeTree(root);
    }
    if (previous !== null) setHost(previous);
  }

  /** Report an error from a view running on this host, as the markup host does. */
  report(error: unknown): void {
    this.markup.reportError(error);
  }

  /** The root element's markup with the engine's markers, once the views settled. */
  async rendered(): Promise<string> {
    await this.markup.settle();
    const element = this.element;
    if (element === null) throw new Error("The app rendered no root element");
    return serialize(element);
  }
}

/** Render the manifest's app at a path on the markup host, and answer the root element's markup with markers. */
export const renderApp = async (manifest: AppManifest, options: RenderOptions = {}): Promise<string> => {
  const adapters = options.adapters ?? [];
  const host = new StaticHost(options.path ?? "/", options.args, adapters);
  const run = new AppRun(manifest, host, adapters.length === 0);
  const previousWrap = config.wrap;
  configureView({
    wrap: (work, label) => {
      previousWrap(work, label);
      work.catch((error) => {
        host.report(error);
      });
    },
  });
  try {
    await run.start();
    return await host.rendered();
  } finally {
    configureView({ wrap: previousWrap });
    await run.stop();
  }
};

const ATTRIBUTE_URL = /(\b(?:href|src)\s*=\s*)(["'])(\/(?!\/)[^"']*)\2/gi;

/** Put the app's base before every root-relative `href` and `src` in rendered markup; unchanged with no base. */
const markupWithBase = (markup: string, base: string): string => (base === "" ? markup : markup.replace(ATTRIBUTE_URL, (_match, lead: string, quote: string, url: string) => `${lead}${quote}${withBase(base, url)}${quote}`));

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeAttribute = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const putMeta = (page: string, attribute: "name" | "property", key: string, value: string): string => {
  const pattern = new RegExp(`<meta\\b[^>]*\\b${attribute}=(["'])${escapeRegExp(key)}\\1[^>]*>`, "i");
  const found = pattern.exec(page);
  if (value === "") return found === null ? page : page.replace(pattern, "");
  if (found === null) {
    return page.replace(/<\/head>/i, () => `<meta ${attribute}="${key}" content="${escapeAttribute(value)}"></head>`);
  }
  const tag = /\bcontent=/i.test(found[0])
    ? found[0].replace(/\bcontent=(["'])[\s\S]*?\1/i, () => `content="${escapeAttribute(value)}"`)
    : found[0].replace(/>$/, () => ` content="${escapeAttribute(value)}">`);
  return page.replace(found[0], () => tag);
};

const putCanonical = (page: string, href: string): string => {
  const pattern = /<link\b[^>]*\brel=(["'])canonical\1[^>]*>/i;
  const found = pattern.exec(page);
  if (href === "") return found === null ? page : page.replace(pattern, "");
  if (found === null) return page.replace(/<\/head>/i, () => `<link rel="canonical" href="${escapeAttribute(href)}"></head>`);
  const tag = /\bhref=/i.test(found[0])
    ? found[0].replace(/\bhref=(["'])[\s\S]*?\1/i, () => `href="${escapeAttribute(href)}"`)
    : found[0].replace(/>$/, () => ` href="${escapeAttribute(href)}">`);
  return page.replace(found[0], () => tag);
};

const putAlternates = (page: string, links: readonly AlternateLink[]): string => {
  const without = page.replace(/<link\b[^>]*\brel=(["'])alternate\1[^>]*>\s*/gi, "");
  if (links.length === 0) return without;
  const tags = links.map((link) => `<link rel="alternate" hreflang="${escapeAttribute(link.hreflang)}" href="${escapeAttribute(link.href)}">`).join("");
  return without.replace(/<\/head>/i, () => `${tags}</head>`);
};

const putJsonLd = (page: string, blocks: readonly unknown[]): string => {
  const without = page.replace(/<script\b[^>]*\bdata-light-jsonld\b[^>]*>[\s\S]*?<\/script>\s*/gi, "");
  if (blocks.length === 0) return without;
  const tags = blocks
    .map((block) => `<script type="application/ld+json" data-light-jsonld>${JSON.stringify(block).replace(/&/g, "\\u0026").replace(/</g, "\\u003c")}</script>`)
    .join("");
  return without.replace(/<\/head>/i, () => `${tags}</head>`);
};

/** Write a page head into a built page's `<head>`, updating an existing tag in place and creating a missing one. */
const putHead = (page: string, head: Head): string => {
  const title = documentTitleOf(head);
  const canonical = canonicalOf(head);
  let out = /<title>[\s\S]*?<\/title>/i.test(page)
    ? page.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeAttribute(title)}</title>`)
    : page.replace(/<\/head>/i, () => `<title>${escapeAttribute(title)}</title></head>`);
  out = putMeta(out, "name", "description", head.description);
  out = putCanonical(out, canonical);
  out = putMeta(out, "property", "og:title", title);
  out = putMeta(out, "property", "og:description", head.description);
  out = putMeta(out, "property", "og:url", canonical);
  out = putMeta(out, "property", "og:type", "website");
  out = putMeta(out, "property", "og:image", absoluteImageOf(head));
  out = putMeta(out, "name", "twitter:card", head.image === "" ? "summary" : "summary_large_image");
  if (head.locales.length > 1) out = putMeta(out, "property", "og:locale", head.locale);
  if (head.locales.length > 1) out = putAlternates(out, alternatesOf(head));
  out = putJsonLd(out, head.jsonLd);
  return out;
};

/** Put `dark` on the page's `<html>` so a dark app paints dark before its scripts run. */
const withScheme = (page: string, scheme: "dark" | "light" | "system"): string => {
  if (scheme !== "dark") return page;
  return page.replace(/<html(\s[^>]*)?>/i, (tag) => {
    const classAttribute = /\sclass=(["'])(.*?)\1/.exec(tag);
    if (classAttribute !== null) {
      const classes = classAttribute[2].trim();
      return tag.replace(classAttribute[0], ` class="${classes ? `${classes} dark` : "dark"}"`);
    }
    return tag.replace(/>$/, ' class="dark">');
  });
};

/** Put `renderApp`'s markup in a built page in place of its root placeholder, with the prerender marker first in `<head>`. */
export const renderPage = async (manifest: AppManifest, page: string, options: RenderOptions = {}): Promise<string> => {
  const tag = manifest.app.root ?? "app-root";
  const name = escapeRegExp(tag);
  const placeholder = new RegExp(`<${name}(?:\\s[^>]*)?>\\s*</${name}>`);
  if (!placeholder.test(page)) throw new Error(`The page has no <${tag}></${tag}> placeholder for the app's root view`);
  const markup = markupWithBase(await renderApp(manifest, options), manifest.app.base);
  const head = currentHead.peek();
  const withRoot = withScheme(page.replace(placeholder, () => markup), manifest.app.scheme);
  const withHead = putHead(withRoot, head);
  return withHead.replace(/<head(\s[^>]*)?>/i, (tag) => tag + PRERENDER_SCRIPT);
};
