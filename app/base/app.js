/**
 * @bootstrapp/base: kernel.
 *
 * Hosts the `$APP` global. Detects the runtime, loads the manifest, and
 * orchestrates the lifecycle (`load` → `bootstrap`). Core areas and
 * packages alike integrate as extensions of the app host, loaded by the
 * awaited `boot:extensions` emit. The kernel itself knows nothing about
 * `Model`, `View`, `theme`, etc.
 *
 * Framework contracts (the `BootstrappApp`/`RegisteredModule` shapes
 * other packages integrate against) live in `bootstrapp/base` (`base/types.ts`).
 */

/** @import { BootstrappApp, InitFn, Manifest, RegisteredModule, RuntimeName } from "/app/base/app.js" */

import { appUrl } from "/app/url/index.js";
import { BOOT_EXTENSIONS } from "./events.js";
import { events, installEventRegistry, registerEventConstants } from "../events/index.js";
import { resolveAppProfile } from "./app-profiles.js";
import { createSettle } from "./settle.js";
import { createCollection, mergeCollection, fs, formatBytes } from "./utils.js";

/**
 * Register a module on `$APP`. Sets `$APP[name] = base`, stores the
 * descriptor in `$APP.modules`, wires any declared event handlers,
 * and emits `MODULE:ADDED`. Idempotent on `name`.
 *
 * @this {BootstrappApp}
 * @param {RegisteredModule} module
 * @returns {unknown}
 */
function addModule(module) {
  const slots = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (this));
  if (this.modules.has(module.name)) return slots[module.name];

  const { name, events: moduleEvents, base = {} } = module;

  this.modules.set(name, module);
  slots[name] = base;

  if (moduleEvents) {
    const handlers =
      typeof moduleEvents === "function"
        ? /** @type {(ctx: any) => Record<string, (data?: unknown) => unknown>} */ (moduleEvents)({ $APP: this, context: base })
        : /** @type {Record<string, (data?: unknown) => unknown>} */ (moduleEvents);
    for (const [eventName, fn] of Object.entries(handlers))
      this.events.on(eventName, /** @type {(data?: unknown) => unknown} */ (fn));
  }

  const moduleAddedHandlers = this.events.get("moduleAdded") || [];
  for (const fn of moduleAddedHandlers)
    /** @type {Function} */ (fn).call(base, { module });

  this.events.emit("module:added", { name: module.name });
  return base;
}

/** @type {RuntimeName} */
const runtime = (() => {
  const g = /** @type {any} */ (globalThis);
  if (
    typeof g.ServiceWorkerGlobalScope !== "undefined" &&
    g instanceof g.ServiceWorkerGlobalScope
  )
    return "serviceworker";
  if (
    typeof g.WorkerGlobalScope !== "undefined" &&
    g instanceof g.WorkerGlobalScope
  )
    return "worker";
  return "frontend";
})();

/** @type {Manifest} */
const initialManifest = {
  runtime,
  dev: true,
  backend: false,
  frontend: runtime !== "worker",
  basePath: "",
  trace: { stack: false, timing: false, source: false },
};

const prototypeAPP = {
  /**
   * Resolve the manifest (from injected global or `/.bootstrapp.json`),
   * then hand off to `bootstrap()`.
   *
   * @this {BootstrappApp}
   * @param {boolean} [production]
   * @param {boolean} [backend]
   * @param {InitFn} [initFn]
   * @returns {Promise<void>}
   */
  async load(production, backend = false, initFn) {
    try {
      /** @type {Manifest} */
      let manifest;
      if (globalThis.__BOOTSTRAPP_MANIFEST__)
        manifest = /** @type {Manifest} */ (globalThis.__BOOTSTRAPP_MANIFEST__);
       else {
        const response = await fetch(appUrl("/.bootstrapp.json"));
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        manifest = /** @type {Manifest} */ (await response.json());
      }
      this.manifest = manifest;
      registerEventConstants(this.events, /** @type {any} */ (manifest).eventRegistry ?? {});
      if (!backend && globalThis.document && this.manifest.appProfiles)
        await resolveAppProfile(this.manifest);
      await this.bootstrap({ production, backend, initFn });
    } catch (error) {
      console.error("[bootstrapp] Load failed:", error);
      this.events.emit("app:bootstrap-error", { error });
    }
  },

  /**
   * Boot sequence:
   *   1. Stamp runtime flags onto the manifest.
   *   2. Emit awaited `boot:extensions`: the app host (`framework/app/host.js`,
   *      seeded by the entry points) loads every `manifest.extensions.app`
   *      entry: core areas first (flagged `core: true`, fail-hard; this is
   *      what attaches `$APP.View`, `$APP.Router`, …), then
   *      packages (log-and-continue).
   *   3. (Optional) Import `/index.js`: shared entry that runs in both
   *      frontend and worker; missing is not an error.
   *   4. Emit `boot:config` → `boot:wire` → `boot:ready`.
   *   5. Run the runtime-specific `initFn` (project's frontend.js / backend.js).
   *   6. Emit `app:init`.
   *
   * @this {BootstrappApp}
   * @param {{ backend?: boolean, production?: boolean, initFn?: InitFn }} [options]
   * @returns {Promise<BootstrappApp>}
   */
  async bootstrap(options = {}) {
    const { backend = false, production = false, initFn } = options;
    Object.assign(this.manifest, {
      backend,
      runtime,
      frontend: !backend,
      production,
    });

    if (this.manifest.apiUrl) this.apiUrl = this.manifest.apiUrl;
    if (this.manifest.version) /** @type {any} */ (this).version = this.manifest.version;

    try {
      await this.events.emit(BOOT_EXTENSIONS);

      try {
        const sharedEntry = appUrl("/index.js");
        await import(sharedEntry);
      } catch { }

      await this.events.emit("boot:config");
      await this.events.emit("boot:wire");
      await this.events.emit("boot:ready");

      if (initFn) await initFn();

      await this.events.emit("app:init");
    } catch (error) {
      console.error("[bootstrapp] Bootstrap failed:", error);
      this.events.emit("app:bootstrap-error", { error });
    }
    return this;
  },
};

const createApp = () => {
  const app = /** @type {BootstrappApp} */ (/** @type {unknown} */ (Object.create(prototypeAPP)));
  /** @type {any} */ (app).runtime = runtime;
  app.manifest = initialManifest;
  app.events = installEventRegistry(events);
  app.settle = createSettle();
  app.modules = new Map();
  app.addModule = addModule.bind(app);
  app.fs = fs;
  /** @type {any} */ (app).createCollection = createCollection;
  /** @type {any} */ (app).mergeCollection = mergeCollection;
  app.formatBytes = formatBytes;
  app.utils = /** @type {BootstrappApp["utils"]} */ (createCollection());
  return app;
};

const existingApp = /** @type {BootstrappApp | undefined} */ (/** @type {any} */ (globalThis).$APP);
const $APP = existingApp ?? /** @type {BootstrappApp} */ (createApp());
globalThis.$APP = $APP;
globalThis.sleep = (/** @type {number} */ ms = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default $APP;
