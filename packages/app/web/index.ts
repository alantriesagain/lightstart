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
import { html } from "@lightstart/light/html";
import { configureNavigation } from "@lightstart/light/navigation";
import { listen } from "@lightstart/router/listen";
import { applyTheme } from "@lightstart/light/theme";
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

  /** Run the route change inside `document.startViewTransition` where the browser has it, then wait for `<app-container>` to draw the next view. */
  transition(apply: () => Promise<void> | void): Promise<void> {
    const doc = globalThis.document;
    const start = (doc as unknown as { startViewTransition?: (callback: () => Promise<void> | void) => { finished: Promise<void> } }).startViewTransition;
    if (typeof start !== "function") return Promise.resolve(apply()).then(() => undefined);
    // The container draws the next view's element, then that view draws its content: wait for both, so the snapshot has the page the user will see.
    const updated = (element: Element | null): Promise<void> => {
      const update = element === null ? null : (element as unknown as { $requestUpdate?: () => Promise<void> }).$requestUpdate;
      return typeof update === "function" ? update.call(element) : Promise.resolve();
    };
    const draw = (): Promise<void> => {
      const container = this.mounted === null ? null : this.mounted.querySelector("app-container");
      return updated(container).then(() => updated(container === null ? null : container.firstElementChild));
    };
    const update = (): Promise<void> => Promise.resolve(apply()).then(draw);
    return new Promise<void>((resolve, reject) => {
      let transition: { finished: Promise<void> };
      try {
        transition = start.call(doc, update);
      } catch (error) {
        reject(error);
        return;
      }
      transition.finished.then(() => resolve(), () => resolve());
    });
  }

  mount(run: AppRun): Promise<void> {
    return this.put(run);
  }

  private async put(run: AppRun): Promise<void> {
    registerContainer();
    const theme = await loadPreset(run.app.theme ?? "default");
    if (theme !== null) applyTheme(theme);
    if (run.router !== null) {
      configureNavigation(run.router.navigation);
      // A plain link to a path of the app goes through the router too, not only an lc-link.
      this.unlisten?.();
      this.unlisten = listen(document, run.router);
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

  /** Stop handing the page's link clicks to the router of the run that is going. */
  stopListening(): void {
    this.unlisten?.();
    this.unlisten = null;
  }

  unmount(_run: AppRun): void {
    this.stopListening();
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
