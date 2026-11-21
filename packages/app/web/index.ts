/// <reference lib="dom" />
/**
 * @file `@lightstart/app/web`: the web host. It always runs `memory`; the
 * generated entry imports the optional features the app's config uses and
 * hands them to `start`: the IndexedDB kind (`web/indexeddb.ts`), worker
 * stores (`web/worker.ts`), view transitions and their morph
 * (`web/transitions.ts`), and the URL's arguments (`web/args.ts`). The routes
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
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { createStore, storeRequest } from "@lightstart/light/model/store";
import type { StorageAdapter, Store } from "@lightstart/light/model/types.ts";
import { configureModel } from "@lightstart/light/model";
import { AppHost, AppRun, currentParams, currentView } from "../run.ts";
import type { RouteTransition } from "../run.ts";
import { absoluteImageOf, canonicalOf, currentHead, documentTitleOf } from "../head.ts";
import type { Head } from "../head.ts";
import { MemoryKind, plan, schemasOf, StoreKind } from "../stores.ts";
import type { WebArgsFeature, WebTransitionFeature, WebTransitionPort, WebWorkerConnection, WebWorkerFeature } from "./features.ts";

export { currentParams, currentView, navigate } from "../run.ts";

/** A running app: `stop()` takes the view down, disposes its controllers, stops following the routes and closes its stores. */
export interface AppHandle {
  stop(): Promise<void>;
}

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

/** The view the routes answer, its path's parameters set on it as props; the same element while the tag stays. */
class AppContainer extends View {
  private tag = "";
  private made: HTMLElement | null = null;

  render(): unknown {
    const tag = currentView.value;
    const params = currentParams.value;
    if (tag === null) return html``;
    if (tag !== this.tag || this.made === null) {
      this.tag = tag;
      // A prerendered page's container already holds the served view: keep it, so its own render adopts the served DOM.
      const served = this.made === null ? this.querySelector(tag) : null;
      this.made = served instanceof HTMLElement && served.parentElement === this ? served : document.createElement(tag);
    }
    for (const [key, value] of Object.entries(params)) Reflect.set(this.made, key, value);
    return html`${this.made}`;
  }
}

let registered = false;

const registerContainer = (): void => {
  if (registered) return;
  View.register("app-container", AppContainer);
  registered = true;
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

/** What a web host may start with instead of the page's: the kinds it runs and its default kind (a test's kinds and memory), and the optional features the entry imported. */
export interface WebHostOptions {
  /** The kinds beyond `memory`, which the host always has. */
  kinds?: readonly StoreKind[];
  defaultKind?: string;
  /** The worker feature for stores declared `worker: true`; absent, every store opens on the page. */
  worker?: WebWorkerFeature;
  /** The view-transition and morph feature; absent, the host's `transition` is the plain default. */
  transitions?: WebTransitionFeature;
  /** The URL's arguments; absent, the host answers no values. */
  args?: WebArgsFeature;
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
  readonly kinds: readonly StoreKind[];
  readonly defaultKind: string;
  private mounted: Element | null = null;
  /** Stops handing the page's link clicks to the run's router. */
  private unlisten: (() => void) | null = null;
  private readonly workerFeature: WebWorkerFeature | null;
  private readonly transitions: WebTransitionFeature | null;
  private readonly argsFeature: WebArgsFeature | null;
  private connection: WebWorkerConnection | null = null;
  private headEffect: { dispose(): void } | null = null;
  private onScroll: (() => void) | null = null;
  private onPopState: (() => void) | null = null;
  private previousScrollRestoration: ScrollRestoration | null = null;
  private historyNavigation = false;
  private readonly scrollPositions = new Map<string, number>();
  /** The `href` of the page on screen. */
  private currentHref: string | null = null;

  constructor(options: WebHostOptions = {}) {
    super();
    const given = options.kinds ?? [];
    this.kinds = given.some((kind) => kind.name === "memory") ? given : [...given, new MemoryKind()];
    this.defaultKind = options.defaultKind ?? (this.kinds.some((kind) => kind.name === "indexeddb") ? "indexeddb" : "memory");
    this.workerFeature = options.worker ?? null;
    this.transitions = options.transitions ?? null;
    this.argsFeature = options.args ?? null;
  }

  /** Open every store as the host does; a store declared `worker: true` opens in a worker spawned once for the run. */
  openStores(manifest: AppManifest, memoryOnly: boolean): Promise<Store> {
    const models = schemasOf(manifest);
    const databases: Record<string, StorageAdapter> = {};
    const feature = this.workerFeature;
    let connection: WebWorkerConnection | null = null;
    const openOne = async (p: ReturnType<typeof plan>[number]): Promise<void> => {
      if (!p.worker || feature === null) {
        databases[p.store] = await p.kind.open(manifest.app, p.store, p.at, models, p.store === "main");
        return;
      }
      if (connection === null) {
        const made = await feature.connect(() => {
          if (this.connection === made) this.connection = null;
        });
        this.connection = made;
        connection = made;
      }
      connection.retain();
      try {
        databases[p.store] = await feature.open(connection, p, memoryOnly);
      } catch (error) {
        const message = connection.failedMessage();
        connection.release();
        throw message === "" ? error : new Error(message);
      }
    };
    const opened = plan(manifest, this, memoryOnly).reduce((before, p) => before.then(() => openOne(p)), Promise.resolve());
    return opened.then(() => {
      const store = createStore({ models, databases, defaultAdapter: "main" });
      configureModel({ request: storeRequest(store) });
      return store;
    });
  }

  /** The URL's arguments when the entry passed the feature; none otherwise. */
  args(app: App): Record<string, unknown> {
    return this.argsFeature === null ? {} : this.argsFeature(app);
  }

  history(): RouterAdapter {
    return createBrowserAdapter();
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
    applyScheme(run.app.scheme);
    const theme = await loadPreset(run.app.theme ?? "default");
    if (theme !== null) applyTheme(theme);
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
      markStarted();
      this.scrollToHash(run);
      return;
    }
    const made = document.createElement(tag);
    if (placeholder === null) document.body.append(made);
    else placeholder.replaceWith(made);
    this.mounted = made;
    markStarted();
    this.scrollToHash(run);
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
      this.scrollPositions.set(win.location.href, win.scrollY);
    };
    win.addEventListener("scroll", this.onScroll, { passive: true });
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
    if (scroll !== null) win.removeEventListener("scroll", scroll);
    if (pop !== null) win.removeEventListener("popstate", pop);
    this.onScroll = null;
    this.onPopState = null;
    if (this.previousScrollRestoration !== null) {
      win.history.scrollRestoration = this.previousScrollRestoration;
      this.previousScrollRestoration = null;
    }
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
    if (historyNavigation) win.scrollTo(0, this.scrollPositions.get(win.location.href) ?? 0);
    else if (target !== null) target.scrollIntoView();
    else win.scrollTo(0, 0);
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
    this.stopListening();
    this.stopPage();
    const mounted = this.mounted;
    this.mounted = null;
    if (mounted !== null) mounted.replaceWith(document.createElement(mounted.tagName.toLowerCase()));
  }

  exit(_code: number): void {}
}

/** What `start` takes beside the manifest: the optional features the generated entry imported. */
export interface WebStartOptions extends WebHostOptions {}

/** Start the app on the web; answers the handle that stops it. A hand-written entry may pass nothing and gets memory stores, no transitions and no arguments; the generated entry is the supported path. */
export const start = async (manifest: AppManifest, options: WebStartOptions = {}): Promise<AppHandle> => {
  const run = new AppRun(manifest, new WebHost(options));
  await run.start();
  return { stop: () => run.stop() };
};
