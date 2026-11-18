/**
 * @file `@lightstart/app/static`: an app's page rendered in node, without a
 * browser. `renderApp` runs the app as `openApp` does (memory stores unless
 * `kinds`, the arguments, the controllers ready) over a history in memory at
 * a path, and mounts its root view on light's markup host; it answers the
 * root element's markup with the engine's markers. `renderPage` puts that
 * markup in a built page in place of its root placeholder and marks the page
 * prerendered, as `light build --prerender` does.
 *
 * Render on the markup host only after `@lightstart/light/markup` is imported:
 * it names the markup element and registry to light's views, and a view
 * module registers when it loads. Import it before the app's manifest (the
 * generated `.light/app.ts`), which imports every view.
 */

import { MRoot, MarkupHost, serialize } from "@lightstart/light/markup";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { configure, currentHost, disposeTree, setHost } from "@lightstart/light/html/core.js";
import { effect } from "@lightstart/light/signals";
import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { MElement } from "@lightstart/light/markup/node.js";
import { get as registeredView } from "@lightstart/light/markup/registry.js";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppHost, AppRun, currentParams, currentView } from "../run.ts";
import { MemoryKind, StoreKind } from "../stores.ts";
import { PRERENDER_SCRIPT } from "../node/prerender.ts";

/** What a static render runs with: where the routes start, the app's arguments (an argv list or a record over the defaults), and the store kinds it runs (every store in memory when absent). */
export interface RenderOptions {
  /** The path the in-memory history starts at. */
  path?: string;
  args?: readonly string[] | Record<string, unknown>;
  /** The kinds the stores open with, the first the default; `memory` is always available. None opens every store in memory. */
  kinds?: readonly StoreKind[];
}

/** The view the routes answer, its path's parameters set on it as props; drawn as the markup host's element for the tag. */
class StaticAppContainer extends View {
  private shown = "";
  private made: MElement | null = null;

  override render(): unknown {
    const tag = currentView.value;
    const params = currentParams.value;
    if (tag === null) return html``;
    if (tag !== this.shown || this.made === null) {
      this.shown = tag;
      this.made = currentHost().createElement(tag) as MElement;
    }
    for (const [key, value] of Object.entries(params)) Reflect.set(this.made, key, value);
    return html`${this.made}`;
  }
}

let registered = false;

const registerContainer = (): void => {
  if (registered) return;
  View.register("app-container", StaticAppContainer);
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

  constructor(path: string, given: readonly string[] | Record<string, unknown> | undefined, kinds: readonly StoreKind[]) {
    super();
    this.path = path;
    this.given = given;
    this.kinds = kinds.length > 0 ? kinds : [new MemoryKind()];
    this.defaultKind = this.kinds[0]?.name ?? "memory";
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
  const kinds = options.kinds ?? [];
  const host = new StaticHost(options.path ?? "/", options.args, kinds);
  const run = new AppRun(manifest, host, kinds.length === 0);
  try {
    await run.start();
    return await host.rendered();
  } finally {
    await run.stop();
  }
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Put `renderApp`'s markup in a built page in place of its root placeholder, with the prerender marker first in `<head>`. */
export const renderPage = async (manifest: AppManifest, page: string, options: RenderOptions = {}): Promise<string> => {
  const tag = manifest.app.root ?? "app-root";
  const name = escapeRegExp(tag);
  const placeholder = new RegExp(`<${name}(?:\\s[^>]*)?>\\s*</${name}>`);
  if (!placeholder.test(page)) throw new Error(`The page has no <${tag}></${tag}> placeholder for the app's root view`);
  const markup = await renderApp(manifest, options);
  const withRoot = page.replace(placeholder, markup);
  return withRoot.replace(/<head(\s[^>]*)?>/i, (head) => head + PRERENDER_SCRIPT);
};
