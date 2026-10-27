/**
 * @bootstrapp/router
 * Framework-agnostic URLPattern-based client-side router.
 *
 * Public types live in `./types.ts`. Cross-package consumers reach them
 * via `import("/app/router/index.js").Foo`.
 */

export { createRouterCore } from "./core.js";
export { defineRoutes, registerRoutes, normalizeRoute } from "./define.js";
export { createRouter, createMemoryRouter, initRouterApp } from "./app.js";
export { createBrowserAdapter } from "./adapters/browser.js";
export { createMemoryAdapter } from "./adapters/memory.js";
export { flattenRoutes, compileRoutes, matchRoute, createPatternString } from "./matcher.js";
export { signalPlugin } from "./plugins/signal.js";

import { createRouter } from "./app.js";
import { createBrowserAdapter } from "./adapters/browser.js";
import $APP from "/app/base/app.js";

const Router = createRouter({
  adapter: typeof window !== "undefined" ? createBrowserAdapter() : undefined,
});

export { Router };
export default Router;

if (globalThis.$APP) $APP.Router = Router;
