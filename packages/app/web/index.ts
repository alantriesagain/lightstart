/// <reference lib="dom" />
/**
 * @file `@lightstart/app/web`: the web host. Its store kinds are `indexeddb`
 * (the default where the page has IndexedDB, memory where it has none) and
 * `memory`, and a project's own. The arguments come from the page's URL
 * query (`?greeting=hi&trust`). The routes follow the browser's history, the
 * theme preset is applied as CSS variables, and the root view is mounted in
 * the page, `<app-outlet>` drawing the view the routes answer. The views were
 * imported by the generated manifest, so every tag exists before the root
 * view is made.
 */

import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { configureNavigation } from "@lightstart/light/navigation";
import { listen } from "@lightstart/router/listen";
import { applyTheme } from "@lightstart/light/theme";
import { loadPreset } from "@lightstart/light/theme/presets.js";
import { createAdapter, hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import IndexedDBAdapter from "@lightstart/light/model/indexeddb";
import type { ModelSchema, StorageAdapter } from "@lightstart/light/model/types.ts";
import { createBrowserAdapter } from "@lightstart/router/adapters/browser";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import { parseArgs } from "@lightstart/cli/argv.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppHost, AppRun, currentParams, currentView } from "../run.ts";
import { MemoryKind, StoreKind } from "../stores.ts";

export { currentParams, currentView, navigate } from "../run.ts";

/** A running app: `stop()` takes the view down, disposes its controllers, stops following the routes and closes its stores. */
export interface AppHandle {
  stop(): Promise<void>;
}

const openIndexedDB = async (name: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> => {
  if (!hasAdapter("indexeddb")) registerStorageAdapter("indexeddb", IndexedDBAdapter);
  const db = createAdapter("indexeddb", { name, version: 1, models, isDefaultAdapter: main });
  await db.init();
  return db;
};

/** The page's IndexedDB: a database per store, the app's name for `main` unless the store names one (`at`). */
export class IndexedDBKind extends StoreKind {
  readonly name = "indexeddb";

  open(app: App, store: string, at: string, models: Record<string, ModelSchema>, main: boolean): Promise<StorageAdapter> {
    return openIndexedDB(at.length > 0 ? at : main ? app.name : app.name + ":" + store, models, main);
  }
}

/** The view the routes answer, its path's parameters set on it as props; the same element while the tag stays. */
class AppOutlet extends View {
  private tag = "";
  private made: HTMLElement | null = null;

  render(): unknown {
    const tag = currentView.value;
    const params = currentParams.value;
    if (tag === null) return html``;
    if (tag !== this.tag || this.made === null) {
      this.tag = tag;
      this.made = document.createElement(tag);
    }
    for (const [key, value] of Object.entries(params)) Reflect.set(this.made, key, value);
    return html`${this.made}`;
  }
}

let registered = false;

const registerOutlet = (): void => {
  if (registered) return;
  View.register("app-outlet", AppOutlet);
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
}

/** The web host. */
export class WebHost extends AppHost {
  readonly name = "web";
  readonly kinds: readonly StoreKind[] = [new IndexedDBKind(), new MemoryKind()];
  readonly defaultKind: string = (globalThis as { indexedDB?: unknown }).indexedDB !== undefined ? "indexeddb" : "memory";
  private mounted: Element | null = null;
  /** Stops handing the page's link clicks to the run's router. */
  private unlisten: (() => void) | null = null;

  constructor(options: WebHostOptions = {}) {
    super();
    if (options.kinds !== undefined) this.kinds = options.kinds;
    if (options.defaultKind !== undefined) this.defaultKind = options.defaultKind;
  }

  args(app: App): Record<string, unknown> {
    return parseArgs(app.argsSchema, queryArgv(app)) as Record<string, unknown>;
  }

  history(): RouterAdapter {
    return createBrowserAdapter();
  }

  mount(run: AppRun): Promise<void> {
    return this.put(run);
  }

  private async put(run: AppRun): Promise<void> {
    registerOutlet();
    const theme = await loadPreset(run.app.theme ?? "default");
    if (theme !== null) applyTheme(theme);
    if (run.router !== null) {
      configureNavigation(run.router.navigation);
      // A plain link to a path of the app goes through the router too, not only an lc-link.
      this.unlisten?.();
      this.unlisten = listen(document, run.router);
    }
    const tag = run.app.root ?? "app-root";
    const made = document.createElement(tag);
    const placeholder = document.querySelector(tag);
    if (placeholder === null) document.body.append(made);
    else placeholder.replaceWith(made);
    this.mounted = made;
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

/** Start the app on the web; answers the handle that stops it. */
export const start = async (manifest: AppManifest): Promise<AppHandle> => {
  const run = new AppRun(manifest, new WebHost());
  await run.start();
  return { stop: () => run.stop() };
};
