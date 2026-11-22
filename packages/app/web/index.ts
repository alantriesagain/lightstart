/// <reference lib="dom" />
/**
 * @file `@lightstart/app/web`: the web host. It always runs `memory`; the
 * generated entry imports the optional features the app's config uses and
 * hands them to `start`: the IndexedDB adapter type (`web/indexeddb.ts`), the
 * stores feature (`web/local.ts` or, for `worker: true`, `web/worker.ts`), view
 * transitions and their morph (`web/transitions.ts`), the theme's utility
 * classes (`web/utilities.ts`), and the URL's arguments
 * (`web/args.ts`). The routes
 * follow the browser's history, the theme preset is applied as CSS variables,
 * and the root view is mounted in the page, `<app-container>` drawing the view
 * the routes answer. The views were imported by the generated manifest, so
 * every tag exists before the root view is made.
 */

import View, { configureView } from "@lightstart/light";
import { flushUpdates } from "@lightstart/light/view/core";
import { html } from "@lightstart/light/html";
import { effect } from "@lightstart/light/signals";
import { configureNavigation } from "@lightstart/light/navigation";
import { listen } from "@lightstart/router/listen";
import { applyTheme } from "@lightstart/light/theme";
import { applyScheme } from "@lightstart/light/theme/color-scheme.js";
import { loadPreset } from "@lightstart/light/theme/presets.js";
import { createBrowserAdapter } from "@lightstart/router/adapters/browser";
import { withBase } from "@lightstart/router/url";
import type { RouterAdapter, RouterOptions } from "@lightstart/router/contracts.ts";
import type { RouterCore } from "@lightstart/router/core";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppHost, AppRun, currentParams, currentView, outletAt } from "../run.ts";
import type { RouteTransition, RunStore } from "../run.ts";
import { convertParam } from "../outlet.ts";
import type { OutletPosition } from "../outlet.ts";
import { absoluteImageOf, canonicalOf, currentHead, documentTitleOf } from "../head.ts";
import type { Head } from "../head.ts";
import { MemoryAdapterType, AdapterType } from "../stores.ts";
import type { WebArgsFeature, WebStoresFeature, WebTransitionFeature, WebTransitionPort, WebUtilitiesFeature } from "./features.ts";

export { currentParams, currentRoute, currentView, href, navigate, url } from "../run.ts";

/** A running app: `stop()` takes the view down, disposes its controllers, stops following the routes and closes its stores. */
export interface AppHandle {
  /** The run's router, for a page that drives or reads it beside the app's own API; null without routes. */
  router: RouterCore | null;
  stop(): Promise<void>;
}

/** How long a restored position is held while the page grows into it. */
const RESTORE_MS = 1500;
const READER_INPUT = ["wheel", "touchstart", "pointerdown", "keydown"];

/** The column the page scrolls in: an element marked `data-scroll-root`, else none (the window). */
const scrollRoot = (): Element | null => document.querySelector("[data-scroll-root]");

const readScroll = (): number => scrollRoot()?.scrollTop ?? globalThis.window.scrollY;

const writeScroll = (y: number): void => {
  const root = scrollRoot();
  if (root !== null) root.scrollTop = y;
  else globalThis.window.scrollTo(0, y);
};

/** Whether this page was rendered ahead of time (`light build --prerender` marks it). */
const prerenderedPage = (): boolean => (globalThis as { __PRERENDERED__?: unknown }).__PRERENDERED__ === true;

let markStarted: () => void = () => {};
const started = new Promise<void>((resolve) => {
  markStarted = resolve;
});
/** The work views hand over with `trackWork` while a prerendered page boots. */
const pending = new Set<Promise<unknown>>();

const twoFrames = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Resolves once the run has mounted and the work its views handed over is done: a prerendered region a render cannot adopt before then is held until it. */
const idle = async (): Promise<void> => {
  await started;
  for (;;) {
    await twoFrames();
    if (pending.size === 0) return;
    await Promise.allSettled([...pending]);
  }
};

// On a prerendered page a view's first renders come before its data: light holds what does not match the served DOM until the app is idle, instead of drawing it fresh. The user's first input ends that wait too, so what they asked for shows at once while loads continue. Configured as this module loads, before the manifest defines the views.
if (prerenderedPage()) {
  const firstInput = new Promise<void>((resolve) => {
    const events = ["input", "change", "pointerdown", "keydown"];
    const done = (): void => {
      for (const event of events) document.removeEventListener(event, done, { capture: true });
      resolve();
    };
    for (const event of events) document.addEventListener(event, done, { capture: true, once: true, passive: true });
  });
  configureView({
    wrap: (work: Promise<unknown>) => {
      pending.add(work);
      const done = (): void => {
        pending.delete(work);
      };
      work.then(done, done);
    },
    settle: () => Promise.race([idle(), firstInput]),
  });
}

interface MadePosition {
  level: number;
  kind: "layout" | "view";
}

/** Every element a container made, and the level it draws: a nested container finds its position from the nearest one above it. */
const madePositions = new WeakMap<Element, MadePosition>();

const propTypeOf = (tag: string, key: string): string | null => {
  const constructor = customElements.get(tag) as unknown as { properties?: Record<string, unknown> } | undefined;
  const properties = constructor?.properties ?? {};
  const property = properties[key];
  if (typeof property !== "object" || property === null) return null;
  const type = (property as { $type?: unknown }).$type;
  return typeof type === "string" ? type : null;
};

const positionOf = (container: AppContainer): OutletPosition => {
  let node: Element | null = container.parentElement;
  while (node !== null) {
    const made = madePositions.get(node);
    if (made !== undefined) return made.kind === "layout" ? { level: made.level, kind: "layout" } : { level: made.level + 1, kind: "root" };
    node = node.parentElement;
  }
  return { level: 0, kind: "root" };
};

/** The view the routes answer, wrapped in its layout and its parameters set as props; the same layout and view elements while their tags stay. */
class AppContainer extends View {
  private layoutTag: string | null = null;
  private layoutElement: HTMLElement | null = null;
  private viewTag: string | null = null;
  private viewElement: HTMLElement | null = null;

  render(): unknown {
    const outlet = outletAt(positionOf(this));
    const view = outlet.view;
    if (view === null) return html``;
    if (outlet.layout !== null) {
      if (outlet.layout !== this.layoutTag || this.layoutElement === null) {
        this.layoutTag = outlet.layout;
        // A prerendered page's container already holds the served layout: keep it, so its own render adopts the served DOM.
        const served = this.layoutElement === null ? this.querySelector(outlet.layout) : null;
        this.layoutElement = served instanceof HTMLElement && served.parentElement === this ? served : document.createElement(outlet.layout);
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
      // A prerendered page's container already holds the served view: keep it, so its own render adopts the served DOM.
      const served = this.viewElement === null ? this.querySelector(view) : null;
      this.viewElement = served instanceof HTMLElement && served.parentElement === this ? served : document.createElement(view);
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

let registered = false;

const registerContainer = (): void => {
  if (registered) return;
  View.register("app-container", AppContainer);
  registered = true;
};

const linkIsExternal = (link: Element): boolean => {
  if (link.hasAttribute("data-no-router")) return true;
  const rel = link.getAttribute("rel") ?? "";
  return rel.split(/\s+/).includes("external");
};

/** Put the app's base before an anchor's root-relative `href`, unless it is external. */
const rebaseLink = (link: Element, base: string): void => {
  if (!link.matches("a[href]") || linkIsExternal(link)) return;
  const href = link.getAttribute("href");
  if (href === null || href.startsWith("//")) return;
  const next = withBase(base, href);
  if (next !== href) link.setAttribute("href", next);
};

/** Put the app's base before every root-relative anchor `href` in `root` and under it. */
const rebaseLinks = (root: Element, base: string): void => {
  rebaseLink(root, base);
  for (const link of root.querySelectorAll("a[href]")) rebaseLink(link, base);
};

const setMeta = (head: HTMLElement, attribute: "name" | "property", key: string, value: string): void => {
  const existing = head.querySelector(`meta[${attribute}="${key}"]`);
  if (value === "") {
    existing?.remove();
    return;
  }
  const tag = existing instanceof HTMLMetaElement ? existing : document.createElement("meta");
  if (!(existing instanceof HTMLMetaElement)) {
    tag.setAttribute(attribute, key);
    head.append(tag);
  }
  tag.setAttribute("content", value);
};

const setCanonical = (head: HTMLElement, href: string): void => {
  const existing = head.querySelector('link[rel="canonical"]');
  if (href === "") {
    existing?.remove();
    return;
  }
  const tag = existing instanceof HTMLLinkElement ? existing : document.createElement("link");
  if (!(existing instanceof HTMLLinkElement)) {
    tag.setAttribute("rel", "canonical");
    head.append(tag);
  }
  tag.setAttribute("href", href);
};

/** Put a head on the page: the title, description, canonical link and link-preview tags, each created once and updated in place. */
const applyHead = (head: Head): void => {
  const title = documentTitleOf(head);
  document.title = title;
  const root = document.head;
  if (root === null) return;
  setMeta(root, "name", "description", head.description);
  setCanonical(root, canonicalOf(head));
  setMeta(root, "property", "og:title", title);
  setMeta(root, "property", "og:description", head.description);
  setMeta(root, "property", "og:url", canonicalOf(head));
  setMeta(root, "property", "og:type", "website");
  setMeta(root, "property", "og:image", absoluteImageOf(head));
  setMeta(root, "name", "twitter:card", head.image === "" ? "summary" : "summary_large_image");
};

/** What a web host may start with instead of the page's: the adapter types it runs and its default (a test's adapter types and memory), and the optional features the entry imported. */
export interface WebHostOptions {
  /** The adapter types beyond `memory`, which the host always has. */
  adapters?: readonly AdapterType[];
  defaultAdapter?: string;
  /** Where the run's stores open, on the page or in a worker; absent cannot open any. */
  stores?: WebStoresFeature;
  /** The view-transition and morph feature; absent, the host's `transition` is the plain default. */
  transitions?: WebTransitionFeature;
  /** The URL's arguments; absent, the host answers no values. */
  args?: WebArgsFeature;
  /** The utility-class engine; absent, the host compiles no classes. */
  utilities?: WebUtilitiesFeature;
  /** What the page adds to the router's options: its locales, its origin, a tracker for a route change's work, a navigation hook. */
  router?: RouterOptions;
  /** `false` when the page applies its own theme and color scheme; the host then applies neither. */
  theme?: boolean;
  /** Called with the run's router once it has its first route, before the root view mounts, so what the page shares the router through is in place for the views. */
  routed?: (router: RouterCore) => void;
}

/** The web host. */
/** The element the location's `#hash` names, when the page has one: read from the router's location, so an in-memory history answers too. */
const hashTarget = (run: AppRun): HTMLElement | null => {
  const href = run.router?.adapter.getLocation().href ?? globalThis.location.href;
  const hash = new URL(href, globalThis.location.origin).hash;
  if (hash.length < 2) return null;
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    id = hash.slice(1);
  }
  const found = document.getElementById(id);
  return found instanceof HTMLElement ? found : null;
};

export class WebHost extends AppHost {
  readonly name = "web";
  readonly adapters: readonly AdapterType[];
  readonly defaultAdapter: string;
  private mounted: Element | null = null;
  /** Stops handing the page's link clicks to the run's router. */
  private unlisten: (() => void) | null = null;
  private readonly storesFeature: WebStoresFeature | null;
  private readonly routerExtra: RouterOptions;
  private readonly ownTheme: boolean;
  private readonly onRouted: ((router: RouterCore) => void) | null;
  private readonly transitions: WebTransitionFeature | null;
  private readonly argsFeature: WebArgsFeature | null;
  protected readonly utilities: WebUtilitiesFeature | null;
  private headEffect: { dispose(): void } | null = null;
  private onScroll: (() => void) | null = null;
  private onPopState: (() => void) | null = null;
  /** Lets go of a position being restored. */
  private releaseScroll: () => void = () => undefined;
  private previousScrollRestoration: ScrollRestoration | null = null;
  private historyNavigation = false;
  private readonly scrollPositions = new Map<string, number>();
  /** Keeps root-relative link attributes under the app's base, when it has one. */
  private links: MutationObserver | null = null;
  /** The `href` of the page on screen. */
  private currentHref: string | null = null;

  constructor(options: WebHostOptions = {}) {
    super();
    this.openStores = (manifest: AppManifest, memoryOnly: boolean): Promise<RunStore> => {
      const feature = this.storesFeature;
      if (feature === null) {
        return Promise.reject(new Error("The web host opens no stores: the generated .light/main entry passes a stores feature (LocalStores, or WorkerStores for worker: true) to start"));
      }
      return feature.open(manifest, this, memoryOnly);
    };
    const given = options.adapters ?? [];
    this.adapters = given.some((adapter) => adapter.name === "memory") ? given : [...given, new MemoryAdapterType()];
    this.defaultAdapter = options.defaultAdapter ?? (this.adapters.some((adapter) => adapter.name === "indexeddb") ? "indexeddb" : "memory");
    this.storesFeature = options.stores ?? null;
    this.transitions = options.transitions ?? null;
    this.argsFeature = options.args ?? null;
    this.utilities = options.utilities ?? null;
    this.routerExtra = options.router ?? {};
    this.ownTheme = options.theme !== false;
    this.onRouted = options.routed ?? null;
  }

  /** The URL's arguments when the entry passed the feature; none otherwise. */
  args(app: App): Record<string, unknown> {
    return this.argsFeature === null ? {} : this.argsFeature(app);
  }

  history(): RouterAdapter {
    return createBrowserAdapter();
  }

  routerOptions(): RouterOptions {
    return this.routerExtra;
  }

  routed(router: RouterCore): void {
    this.onRouted?.(router);
  }

  prerendered(): boolean {
    return prerenderedPage();
  }

  clearPrerendered(): void {
    (globalThis as { __PRERENDERED__?: boolean }).__PRERENDERED__ = false;
  }

  /** Run the route change inside the transition feature when the entry passed one; otherwise plainly. */
  transition(apply: () => Promise<void> | void, route?: RouteTransition): Promise<void> {
    const transitions = this.transitions;
    if (transitions === null) return Promise.resolve(apply()).then(() => undefined);
    return transitions.transition(apply, route, this.transitionPort());
  }

  /** What the transition feature reads of this host. */
  private transitionPort(): WebTransitionPort {
    return {
      container: () => this.containerElement(),
      root: () => this.mounted,
      href: () => this.currentHref,
      historyNavigation: () => this.historyNavigation,
    };
  }

  /** The route container in the mounted root, when the page has one. */
  private containerElement(): Element | null {
    const mounted = this.mounted;
    return mounted === null ? null : mounted.querySelector("app-container");
  }

  mount(run: AppRun): Promise<void> {
    return this.put(run);
  }

  private async put(run: AppRun): Promise<void> {
    registerContainer();
    this.transitions?.installStyles();
    const compileClasses = this.utilities !== null && run.app.utilities;
    let theme = null;
    if (this.ownTheme || compileClasses) {
      const given = run.app.theme;
      theme = typeof given === "object" && given !== null ? given : await loadPreset(given ?? "default");
    }
    if (this.ownTheme) {
      applyScheme(run.app.scheme);
      if (theme !== null) applyTheme(theme);
    }
    if (this.utilities !== null && compileClasses && theme !== null) this.utilities.start(theme);
    this.startPage();
    this.currentHref = run.router?.adapter.getLocation().href ?? null;
    if (run.router !== null) {
      configureNavigation(run.router.navigation);
      // A plain link to a path of the app goes through the router too, not only an lc-link.
      this.unlisten?.();
      const off = listen(document, run.router);
      const transitions = this.transitions;
      const capture = transitions === null ? null : (event: Event): void => transitions.recordClick(event);
      if (capture !== null) document.addEventListener("click", capture, true);
      this.unlisten = () => {
        off();
        if (capture !== null) document.removeEventListener("click", capture, true);
      };
    }
    const tag = run.app.root ?? "app-root";
    const placeholder = document.querySelector(tag);
    const adopt = this.prerendered() && placeholder !== null && placeholder.childNodes.length > 0;
    if (adopt && placeholder !== null) {
      this.mounted = placeholder;
      this.startLinks(run.app.base);
      markStarted();
      this.scrollToHash(run);
      return;
    }
    const made = document.createElement(tag);
    if (placeholder === null) document.body.append(made);
    else placeholder.replaceWith(made);
    this.mounted = made;
    this.startLinks(run.app.base);
    markStarted();
    this.scrollToHash(run);
  }

  /** Keep the root-relative `href` of every anchor in the app's DOM under its base, including links drawn later. */
  private startLinks(base: string): void {
    this.stopLinks();
    const root = this.mounted;
    if (base === "" || root === null) return;
    rebaseLinks(root, base);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          if (record.target instanceof Element) rebaseLink(record.target, base);
        } else for (const node of record.addedNodes) if (node instanceof Element) rebaseLinks(node, base);
      }
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    this.links = observer;
  }

  /** Stop keeping the links under the base. */
  private stopLinks(): void {
    this.links?.disconnect();
    this.links = null;
  }

  /** On the first load, once the page has drawn, bring the element the `#hash` names into view: the browser looked for it before the app drew it. */
  private scrollToHash(run: AppRun): void {
    flushUpdates();
    hashTarget(run)?.scrollIntoView();
  }

  /** Follow the page head into the title and tags, take over scroll restoration, and record each entry's scroll position. */
  private startPage(): void {
    this.headEffect?.dispose();
    this.headEffect = effect(() => {
      applyHead(currentHead.value);
    });
    this.liveRegion();
    const win = globalThis.window;
    this.previousScrollRestoration = win.history.scrollRestoration;
    win.history.scrollRestoration = "manual";
    this.onScroll = (): void => {
      this.scrollPositions.set(win.location.href, readScroll());
    };
    document.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
    this.onPopState = (): void => {
      this.historyNavigation = true;
    };
    win.addEventListener("popstate", this.onPopState);
  }

  /** Undo what the web host put on the page: the head effect, the scroll and history listeners and scroll restoration. */
  protected stopPage(): void {
    this.headEffect?.dispose();
    this.headEffect = null;
    const win = globalThis.window;
    const scroll = this.onScroll;
    const pop = this.onPopState;
    if (scroll !== null) document.removeEventListener("scroll", scroll, { capture: true });
    this.releaseScroll();
    if (pop !== null) win.removeEventListener("popstate", pop);
    this.onScroll = null;
    this.onPopState = null;
    if (this.previousScrollRestoration !== null) {
      win.history.scrollRestoration = this.previousScrollRestoration;
      this.previousScrollRestoration = null;
    }
  }

  /** Put a saved position back and hold it for a moment while the page grows into it; the reader's own input, or the next navigation, lets go. */
  private restoreScroll(y: number): void {
    writeScroll(y);
    const until = performance.now() + RESTORE_MS;
    let held = true;
    const letGo = (): void => {
      held = false;
      for (const type of READER_INPUT) globalThis.window.removeEventListener(type, letGo, { capture: true });
    };
    for (const type of READER_INPUT) globalThis.window.addEventListener(type, letGo, { capture: true, passive: true });
    this.releaseScroll = letGo;
    const step = (): void => {
      if (!held) return;
      if (performance.now() > until) {
        letGo();
        return;
      }
      if (Math.abs(readScroll() - y) > 1) writeScroll(y);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** After a route change, once the next view has drawn: scroll, move focus and announce the page's title. */
  routeChanged(run: AppRun, _first: boolean): Promise<void> {
    flushUpdates();
    this.currentHref = run.router?.adapter.getLocation().href ?? this.currentHref;
    this.transitions?.clearClick();
    const historyNavigation = this.historyNavigation;
    this.historyNavigation = false;
    const win = globalThis.window;
    const target = historyNavigation ? null : hashTarget(run);
    this.releaseScroll();
    if (historyNavigation) this.restoreScroll(this.scrollPositions.get(win.location.href) ?? 0);
    else if (target !== null) target.scrollIntoView();
    else writeScroll(0);
    if (run.app.focusOnNavigate) this.focusView(target);
    const region = this.liveRegion();
    region.textContent = document.title;
    return Promise.resolve();
  }

  /** Move focus to the element the `#hash` named when there is one, else the new view's first `h1`, else the view itself, made focusable only until it loses focus. */
  private focusView(anchor: HTMLElement | null = null): void {
    const container = this.mounted;
    const tag = currentView.peek();
    if (container === null || tag === null) return;
    const view = container.querySelector(tag);
    if (!(view instanceof HTMLElement)) return;
    const heading = view.querySelector("h1");
    const target = anchor ?? (heading instanceof HTMLElement ? heading : view);
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => {
      if (target.getAttribute("tabindex") === "-1") target.removeAttribute("tabindex");
    }, { once: true });
    target.focus({ preventScroll: true });
  }

  /** The page's one polite live region, created on first use and visually hidden. */
  private liveRegion(): HTMLElement {
    const existing = document.querySelector("[data-light-live-region]");
    if (existing instanceof HTMLElement) return existing;
    const region = document.createElement("div");
    region.setAttribute("data-light-live-region", "");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.style.position = "absolute";
    region.style.width = "1px";
    region.style.height = "1px";
    region.style.padding = "0";
    region.style.margin = "-1px";
    region.style.overflow = "hidden";
    region.style.clip = "rect(0 0 0 0)";
    region.style.whiteSpace = "nowrap";
    region.style.border = "0";
    document.body.append(region);
    return region;
  }

  /** Stop handing the page's link clicks to the router of the run that is going. */
  stopListening(): void {
    this.unlisten?.();
    this.unlisten = null;
  }

  unmount(_run: AppRun): void {
    this.transitions?.reset();
    this.utilities?.stop();
    this.stopListening();
    this.stopLinks();
    this.stopPage();
    const mounted = this.mounted;
    this.mounted = null;
    if (mounted !== null) mounted.replaceWith(document.createElement(mounted.tagName.toLowerCase()));
  }

  exit(_code: number): void {}
}

/** What `start` takes beside the manifest: the optional features the generated entry imported. */
export interface WebStartOptions extends WebHostOptions {}

/** Start the app on the web; answers the handle that stops it. The generated entry passes the stores feature and the optional transitions and arguments; a hand-written entry with no stores feature cannot start the run. */
export const start = async (manifest: AppManifest, options: WebStartOptions = {}): Promise<AppHandle> => {
  const run = new AppRun(manifest, new WebHost(options));
  await run.start();
  return { router: run.router, stop: () => run.stop() };
};
