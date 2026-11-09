/**
 * @lightstart/router/app: the convenience constructors. They pick or
 * accept an adapter, apply plugins, and initialize the route table. Plugin
 * results are merged onto the router here, away from the native core.
 */

import { createBrowserAdapter } from "./adapters/browser.ts";
import { createMemoryAdapter } from "./adapters/memory.ts";
import { RouterCore } from "./core.ts";
import type { RouterAdapter, RouterOptions, RouterPlugin, RoutesMap } from "./contracts.ts";
import type { Logger } from "./logger.ts";

/** Run every plugin against `router` and merge what each returned. */
export const applyPlugins = (router: RouterCore): void => {
  for (const plugin of router.plugins) {
    if (typeof plugin === "function") {
      const result = plugin(router);
      if (result !== null && typeof result === "object") Object.assign(router, result);
    }
  }
};

/** Create a router over `adapter`, initializing it when routes are supplied. */
export const createRouter = (adapter: RouterAdapter, options: RouterOptions & { routes?: RoutesMap; plugins?: RouterPlugin[]; logger?: Logger } = {}): RouterCore => {
  const router = new RouterCore(adapter, { plugins: options.plugins, logger: options.logger });
  applyPlugins(router);
  if (options.routes) router.init(options.routes, options);
  return router;
};

/** Create a router over a memory adapter, for tests, rendering and native apps. */
export const createMemoryRouter = (options: RouterOptions & { routes?: RoutesMap; plugins?: RouterPlugin[]; initialPath?: string; logger?: Logger } = {}): RouterCore => {
  const { routes, plugins, initialPath, logger, ...rest } = options;
  const router = new RouterCore(createMemoryAdapter(initialPath ?? "/"), { plugins: plugins ?? [], logger });
  applyPlugins(router);
  if (routes) router.init(routes, rest);
  return router;
};

const hasWindow = (): boolean => typeof (globalThis as unknown as { window?: unknown }).window !== "undefined";

/** Create a router over the browser adapter when `window` exists, else memory. */
export const createPlatformRouter = (options: RouterOptions & { routes?: RoutesMap; plugins?: RouterPlugin[]; logger?: Logger } = {}): RouterCore => {
  const adapter = hasWindow() ? createBrowserAdapter() : createMemoryAdapter();
  return createRouter(adapter, options);
};
