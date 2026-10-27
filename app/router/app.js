/**
 * @bootstrapp/router: App Integration
 * Bridges Router to $APP framework features.
 */

import { registerSyncType } from "/app/light/controller/index.js";
import { createBrowserAdapter } from "./adapters/browser.js";
import { createMemoryAdapter } from "./adapters/memory.js";
import { createRouterCore } from "./core.js";
import { installScrollBehavior } from "./plugins/scroll.js";

/**
 * @import {
 *   RouterCore, RouterPlugin, CreateRouterConfig,
 *   CreateMemoryRouterConfig,
 * } from "./types.js"
 * @import { BootstrappApp } from "../base/types.js"
 */

/**
 * @param {CreateRouterConfig} [config]
 * @returns {RouterCore}
 */
export function createRouter(config = {}) {
  const { routes, adapter, plugins = [], ...options } = config;

  const platformAdapter =
    adapter ||
    (typeof window !== "undefined"
      ? createBrowserAdapter()
      : createMemoryAdapter());

  const router = createRouterCore(platformAdapter, { plugins });

  if (routes)
    router.init(routes, options);

  return router;
}

/**
 * @param {CreateMemoryRouterConfig} [config]
 * @returns {RouterCore}
 */
export function createMemoryRouter(config = {}) {
  const { routes, initialPath = "/", plugins = [], ...options } = config;

  const adapter = createMemoryAdapter(initialPath);
  const router = createRouterCore(adapter, { plugins });

  if (routes)
    router.init(routes, options);

  return router;
}

/**
 * Wire a router into `$APP`. Accepts either an existing `Router`
 * instance or an options object (router will be created internally).
 *
 * @param {BootstrappApp} $APP
 * @param {RouterCore | { plugins?: RouterPlugin[] }} [RouterOrOptions]
 * @returns {RouterCore}
 */
export function initRouterApp($APP, RouterOrOptions = {}) {
  /** @type {RouterCore} */
  let router;
  /** @type {RouterPlugin[]} */
  let plugins = [];

  const maybeRouter = /** @type {{ adapter?: unknown }} */ (RouterOrOptions);
  if (maybeRouter?.adapter !== undefined)
    router = /** @type {RouterCore} */ (RouterOrOptions);
  else {
    const options = /** @type {{ plugins?: RouterPlugin[] }} */ (RouterOrOptions);
    plugins = options.plugins || [];
    router = createRouter({ plugins });
  }

  const init = () => {
    const navigation = $APP.manifest.router?.navigation ?? "spa";
    router.init($APP.routes ?? {}, {
      appName: $APP.manifest.name,
      basePath: $APP.manifest.basePath || "",
      isProduction: $APP.manifest.production,
      navigation,
      locales: $APP.manifest.i18n?.locales ?? [],
      defaultLocale: $APP.manifest.i18n?.defaultLocale ?? "en",
      onRouteChange: null,
    });

    if (router.adapter?.type === "browser" && navigation !== "mpa")
      installScrollBehavior(router, $APP);

    const syncKeys = new Set(["currentRoute", "stack"]);
    /** @param {string} key */
    const assertSyncKey = (key) => {
      if (!syncKeys.has(key)) throw new Error(`[router] unknown sync key "${key}".`);
    };
    router.$sync = {
      adapter: "router",
      /** @param {string} key */
      get: (key) => {
        assertSyncKey(key);
        return /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (router))[key];
      },
      /** @param {string} key */
      set: (key) => {
        throw new Error(`[router] "${key}" is not settable from a sync binding.`);
      },
      /** @param {string} key @param {(value: unknown, oldValue: unknown) => void} callback */
      subscribe: (key, callback) => {
        assertSyncKey(key);
        return router.subscribe(key, (value) => callback(value, undefined));
      },
    };

    registerSyncType(
      (/** @type {unknown} */ adapter) => adapter === router,
      (/** @type {unknown} */ _adapter) => ({ adapter: "router", syncObj: router.$sync ?? null }),
    );
  };

  $APP.events.on("app:init", init);

  $APP.addModule({ name: "Router", base: router });

  if (router.adapter?.type === "browser" && typeof window !== "undefined")
    window.addEventListener("popstate", () => router.handleHistoryNavigation());

  return router;
}

export default initRouterApp;
