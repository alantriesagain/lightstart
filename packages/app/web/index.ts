/// <reference lib="dom" />
/**
 * @file `@lightstart/app/web`: the web host. Its store kinds are `indexeddb`
 * (the default where the page has IndexedDB, memory where it has none) and
 * `memory`, and a project's own. The arguments come from the page's URL
 * query (`?greeting=hi&trust`). The routes follow the browser's history, the
 * theme preset is applied as CSS variables, and the root view is mounted in
 * the page, `<app-container>` drawing the view the routes answer. The views were
 * imported by the generated manifest, so every tag exists before the root
 * view is made.
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
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { createStore, storeRequest } from "@lightstart/light/model/store";
import type { StorageAdapter, Store } from "@lightstart/light/model/types.ts";
import { configureModel } from "@lightstart/light/model";
import { AppHost, AppRun, currentParams, currentView } from "../run.ts";
import type { NavigationSource, RouteTransition } from "../run.ts";
import { absoluteImageOf, canonicalOf, currentHead, documentTitleOf } from "../head.ts";
import type { Head } from "../head.ts";
import { MemoryKind, plan, schemasOf, StoreKind } from "../stores.ts";
import { IndexedDBKind } from "./indexeddb.ts";
import { MODEL_OPERATORS, WorkerAdapter, WorkerConnection } from "./worker.ts";

export { currentParams, currentView, navigate } from "../run.ts";
export { IndexedDBKind } from "./indexeddb.ts";

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

/** The URL query as argv tokens for the app's own arguments: `?name=value` and a bare `?flag`; a parameter the app does not declare is left out. */
const queryArgv = (app: App): string[] => {
  const out: string[] = [];
  const query = new URLSearchParams(globalThis.location?.search ?? "");
  for (const [key, value] of query) {
    const spec = app.argsSchema[key];
    if (spec === undefined) continue;
    if ("flag" in spec && spec.flag === true) {
      if (value === "" || value === "true") out.push("--" + key);
    } else out.push("--" + key, value);
  }
  return out;
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

const morphStyles = `
@layer light {
  ::view-transition-group(morph) {
    animation-duration: 420ms;
    animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
  }
  ::view-transition-old(morph),
  ::view-transition-new(morph) {
    height: 100%;
    width: 100%;
    object-fit: none;
    object-position: left top;
  }
  ::view-transition-image-pair(morph) {
    overflow: clip;
  }
  ::view-transition-old(morph) {
    animation: light-morph-out 420ms cubic-bezier(0.2, 0, 0, 1);
  }
  ::view-transition-new(morph) {
    animation: light-morph-in 420ms cubic-bezier(0.2, 0, 0, 1);
  }
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 220ms;
  }
  @keyframes light-morph-out {
    0% { opacity: 1; }
    35% { opacity: 0; }
    100% { opacity: 0; }
  }
  @keyframes light-morph-in {
    0% { opacity: 0; }
    35% { opacity: 1; }
    100% { opacity: 1; }
  }
}
`;

let morphStylesInstalled = false;

/** Install light's default `morph` transition rules once, in the `light` layer so an app's own rules win. */
const installMorphStyles = (): void => {
  if (morphStylesInstalled) return;
  if (document.getElementById("light-morph") !== null) {
    morphStylesInstalled = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "light-morph";
  style.textContent = morphStyles;
  document.head.append(style);
  morphStylesInstalled = true;
};

/** The path of an `href`, for matching a remembered entry against the route now shown. */
const pathOfHref = (href: string): string => {
  try {
    return new URL(href, globalThis.location?.href ?? "http://memory").pathname;
  } catch {
    return href;
  }
};

/** A click that may start a navigation: the anchor, the path it leads to, and when it happened. */
interface ClickSource {
  element: Element;
  path: string;
  at: number;
}

/** What a web host may start with instead of the page's: the kinds it runs and its default kind (a test's kinds and memory). */
export interface WebHostOptions {
  kinds?: readonly StoreKind[];
  defaultKind?: string;
  /** Spawn the worker a store declared `worker: true` opens in; absent, every store opens on the page. */
  worker?: () => Worker;
}

/** The web host. */
export class WebHost extends AppHost {
  readonly name = "web";
  readonly kinds: readonly StoreKind[] = [new IndexedDBKind(), new MemoryKind()];
  readonly defaultKind: string = (globalThis as { indexedDB?: unknown }).indexedDB !== undefined ? "indexeddb" : "memory";
  private mounted: Element | null = null;
  /** Stops handing the page's link clicks to the run's router. */
  private unlisten: (() => void) | null = null;
  private readonly workerFactory: (() => Worker) | null;
  private connection: WorkerConnection | null = null;
  private headEffect: { dispose(): void } | null = null;
  private onScroll: (() => void) | null = null;
  private onPopState: (() => void) | null = null;
  private previousScrollRestoration: ScrollRestoration | null = null;
  private historyNavigation = false;
  private readonly scrollPositions = new Map<string, number>();
  /** The `href` of the page on screen, and for each entry, the route path a morph-forward navigation led to. */
  private currentHref: string | null = null;
  private readonly ledTo = new Map<string, string>();
  /** The anchor a recent click went through, dropped once a navigation uses it or another route change happens. */
  private clickSource: ClickSource | null = null;
  /** The element carrying the `morph` name now, with the inline value to restore. */
  private named: { element: HTMLElement; previous: string } | null = null;

  constructor(options: WebHostOptions = {}) {
    super();
    if (options.kinds !== undefined) this.kinds = options.kinds;
    if (options.defaultKind !== undefined) this.defaultKind = options.defaultKind;
    this.workerFactory = options.worker ?? null;
  }

  /** Open every store as the host does; a store declared `worker: true` opens in a worker spawned once for the run. */
  openStores(manifest: AppManifest, memoryOnly: boolean): Promise<Store> {
    const models = schemasOf(manifest);
    const databases: Record<string, StorageAdapter> = {};
    const factory = this.workerFactory;
    let connection: WorkerConnection | null = null;
    const openOne = async (p: ReturnType<typeof plan>[number]): Promise<void> => {
      if (!p.worker || factory === null) {
        databases[p.store] = await p.kind.open(manifest.app, p.store, p.at, models, p.store === "main");
        return;
      }
      if (connection === null) {
        const made = await WorkerConnection.connect(factory(), () => {
          if (this.connection === made) this.connection = null;
        });
        this.connection = made;
        connection = made;
      }
      connection.retain();
      const adapter = new WorkerAdapter(connection, p.store, p.kindName, p.at, p.store === "main", memoryOnly, MODEL_OPERATORS);
      try {
        await adapter.init();
      } catch (error) {
        const message = connection.failedMessage();
        connection.release();
        throw message === "" ? error : new Error(message);
      }
      databases[p.store] = adapter;
    };
    const opened = plan(manifest, this, memoryOnly).reduce((before, p) => before.then(() => openOne(p)), Promise.resolve());
    return opened.then(() => {
      const store = createStore({ models, databases, defaultAdapter: "main" });
      configureModel({ request: storeRequest(store) });
      return store;
    });
  }

  args(app: App): Record<string, unknown> {
    return parseArgs(app.argsSchema, queryArgv(app)) as Record<string, unknown>;
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

  /** Run the route change inside `document.startViewTransition` where the browser has it, morphing the source into the next view, then wait for `<app-container>` to draw it. */
  transition(apply: () => Promise<void> | void, route?: RouteTransition): Promise<void> {
    installMorphStyles();
    const doc = globalThis.document;
    const start = (doc as unknown as { startViewTransition?: (callback: () => Promise<void> | void) => { finished: Promise<void> } }).startViewTransition;
    if (typeof start !== "function") return Promise.resolve(apply()).then(() => undefined);
    const reduced = typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const path = route?.path ?? "";
    const historyNavigation = this.historyNavigation;
    const from = this.sourceOf(route?.from, path);
    const leftPath = this.currentHref === null ? null : pathOfHref(this.currentHref);
    const reverse = historyNavigation && leftPath !== null && route?.href !== undefined && this.ledTo.get(route.href) === leftPath;
    const morph = !reduced && (historyNavigation ? reverse : from !== null);
    if (morph) {
      if (historyNavigation) this.nameMorph(this.oldMorphElement());
      else if (from !== null) {
        this.nameMorph(from);
        if (this.currentHref !== null) this.ledTo.set(this.currentHref, path);
      }
    }
    this.clickSource = null;
    // The browser pauses rendering, and with it the frame light's host flushes on, until this callback settles: draw the
    // container and the next view now, so the snapshot has the page the user will see and the callback never waits on a frame.
    const update = (): Promise<void> => Promise.resolve(apply()).then(async () => {
      await this.drawNextView();
      if (!morph) return;
      this.clearMorph();
      if (historyNavigation) this.nameMorph(leftPath === null ? null : this.returnMorphElement(leftPath));
      else this.nameMorph(this.newMorphElement());
    });
    const done = new Promise<void>((resolve, reject) => {
      let transition: { finished: Promise<void> };
      try {
        transition = start.call(doc, update);
      } catch (error) {
        this.clearMorph();
        reject(error);
        return;
      }
      transition.finished.then(() => resolve(), () => resolve());
    });
    return done.then(() => {
      this.clearMorph();
    }, (error: unknown) => {
      this.clearMorph();
      throw error;
    });
  }

  /** Flush the pending updates until `<app-container>` holds the view the route now answers, so a morph's target can be found. */
  private async drawNextView(): Promise<void> {
    for (let round = 0; round < 50; round++) {
      flushUpdates();
      const view = currentView.peek();
      const first = this.containerElement()?.firstElementChild ?? null;
      if (view === null ? first === null : first !== null && first.tagName.toLowerCase() === view) return;
      await Promise.resolve();
    }
    flushUpdates();
  }

  /** The source a navigation morphs from: the one the call names, else a fresh click on the path this navigation takes. */
  private sourceOf(given: NavigationSource | undefined, path: string): Element | null {
    if (given instanceof Element) return given;
    const click = this.clickSource;
    if (click === null) return null;
    if (Date.now() - click.at > 1000 || click.path !== path) {
      this.clickSource = null;
      return null;
    }
    return click.element;
  }

  /** Name `element` the transition's `morph`, keeping the name to itself and remembering its inline value. */
  private nameMorph(element: Element | null): void {
    if (!(element instanceof HTMLElement)) return;
    if (this.named !== null && this.named.element !== element) this.clearMorph();
    if (this.named !== null && this.named.element === element) return;
    this.named = { element, previous: element.style.viewTransitionName };
    element.style.viewTransitionName = "morph";
  }

  /** Clear the `morph` name, restoring the inline value the element had. */
  private clearMorph(): void {
    const named = this.named;
    this.named = null;
    if (named === null) return;
    named.element.style.viewTransitionName = named.previous;
  }

  /** The route container in the mounted root, when the page has one. */
  private containerElement(): Element | null {
    const mounted = this.mounted;
    return mounted === null ? null : mounted.querySelector("app-container");
  }

  /** The current view's `[data-morph]` element, else the view element itself. */
  private oldMorphElement(): Element | null {
    const container = this.containerElement();
    if (container === null) return null;
    return container.querySelector("[data-morph]") ?? container.firstElementChild;
  }

  /** The next view's first `[data-morph]` element, else the view element itself. */
  private newMorphElement(): Element | null {
    return this.oldMorphElement();
  }

  /** On the restored page, the first anchor to `path`, preferring one marked `data-morph-source`; none is a plain cross-fade. */
  private returnMorphElement(path: string): Element | null {
    const scope = this.mounted;
    if (scope === null) return null;
    let plain: Element | null = null;
    for (const anchor of scope.querySelectorAll("a[href]")) {
      if (!(anchor instanceof HTMLAnchorElement) || pathOfHref(anchor.href) !== path) continue;
      if (anchor.hasAttribute("data-morph-source")) return anchor;
      if (plain === null) plain = anchor;
    }
    return plain;
  }

  /** Record the anchor a document click goes through, before the router's own listener sees it. */
  private recordClick(event: Event): void {
    if (!(event instanceof MouseEvent)) return;
    let anchor: Element | null = null;
    for (const node of event.composedPath()) {
      if (node instanceof Element && node.tagName === "A") {
        anchor = node;
        break;
      }
    }
    if (!(anchor instanceof HTMLAnchorElement) || anchor.href === "") {
      this.clickSource = null;
      return;
    }
    try {
      this.clickSource = { element: anchor, path: new URL(anchor.href).pathname, at: Date.now() };
    } catch {
      this.clickSource = null;
    }
  }

  mount(run: AppRun): Promise<void> {
    return this.put(run);
  }

  private async put(run: AppRun): Promise<void> {
    registerContainer();
    installMorphStyles();
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
      const capture = (event: Event): void => this.recordClick(event);
      document.addEventListener("click", capture, true);
      this.unlisten = () => {
        off();
        document.removeEventListener("click", capture, true);
      };
    }
    const tag = run.app.root ?? "app-root";
    const placeholder = document.querySelector(tag);
    const adopt = this.prerendered() && placeholder !== null && placeholder.childNodes.length > 0;
    if (adopt && placeholder !== null) {
      this.mounted = placeholder;
      markStarted();
      return;
    }
    const made = document.createElement(tag);
    if (placeholder === null) document.body.append(made);
    else placeholder.replaceWith(made);
    this.mounted = made;
    markStarted();
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
    this.clickSource = null;
    const historyNavigation = this.historyNavigation;
    this.historyNavigation = false;
    const win = globalThis.window;
    if (historyNavigation) win.scrollTo(0, this.scrollPositions.get(win.location.href) ?? 0);
    else win.scrollTo(0, 0);
    if (run.app.focusOnNavigate) this.focusView();
    const region = this.liveRegion();
    region.textContent = document.title;
    return Promise.resolve();
  }

  /** Move focus to the new view's first `h1`, else to the view itself, made focusable only until it loses focus. */
  private focusView(): void {
    const container = this.mounted;
    const tag = currentView.peek();
    if (container === null || tag === null) return;
    const view = container.querySelector(tag);
    if (!(view instanceof HTMLElement)) return;
    const heading = view.querySelector("h1");
    const target = heading instanceof HTMLElement ? heading : view;
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
    this.clearMorph();
    this.clickSource = null;
    this.stopListening();
    this.stopPage();
    const mounted = this.mounted;
    this.mounted = null;
    if (mounted !== null) mounted.replaceWith(document.createElement(mounted.tagName.toLowerCase()));
  }

  exit(_code: number): void {}
}

/** What `start` takes beside the manifest: how to spawn the worker a store may ask for. */
export interface WebStartOptions {
  /** Spawn the worker a store declared `worker: true` opens in. */
  worker?: () => Worker;
}

/** Start the app on the web; answers the handle that stops it. */
export const start = async (manifest: AppManifest, options: WebStartOptions = {}): Promise<AppHandle> => {
  const run = new AppRun(manifest, new WebHost({ worker: options.worker }));
  await run.start();
  return { stop: () => run.stop() };
};
