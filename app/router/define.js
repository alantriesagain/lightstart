/**
 * @bootstrapp/router: defineRoutes
 * The routes citizen: a project (or package) declares its route table in a
 * root `routes.js` default-exporting `defineRoutes(routes, defaults?)`. The
 * definition is pure data; the auto-loader registers it before `app:init`,
 * which is the hard deadline: the router compiles once and never re-reads.
 */

import $APP from "/app/base/app.js";
import { element } from "/app/__light-runtime__.js";

/** @import { RouteConfig, RouteValue, RoutesMap, RoutesDefinition } from "./types.js" */

let compiled = false;
$APP.events.on("app:init", () => {
  compiled = true;
});

/**
 * Normalize one route value: a bare function becomes `{component}`, and a
 * tag-string component becomes a render function. Params (path groups and
 * query params both) spread onto the element as individual `.prop`
 * bindings (`/posts/:slug` → `.slug`), with the whole bag also passed as
 * `.routeParams` (the shape the cms template registry speaks).
 *
 * @param {RouteValue} value
 * @returns {RouteConfig}
 */
export const normalizeRoute = (value) => {
  if (typeof value === "function") return { component: value };
  const route = { .../** @type {RouteConfig} */ (value) };
  if (typeof route.component === "string") {
    const tag = /** @type {string} */ (route.component);
    route.component = (/** @type {Record<string, string> | undefined} */ params) => {
      /** @type {Record<string, unknown>} */
      const bindings = { ".routeParams": params ?? {} };
      for (const [key, param] of Object.entries(params ?? {})) bindings[`.${key}`] = param;
      return element(tag, bindings);
    };
  }
  return route;
};

/**
 * Declare a route table. `defaults` spreads under every entry (a route's own
 * fields win); `defaults.localized: true` expands locale variants from
 * `manifest.i18n.locales` at registration: path prefixed (`/pt-BR/about`),
 * name suffixed (`about-pt-BR`), `locale` stamped. A route's `native` field
 * is merged over it in a native shell (`$APP.env.isNative`), and `native:
 * null` leaves the route out there, so one table serves the web and the app.
 *
 * @param {RoutesMap} routes
 * @param {RouteConfig & { localized?: boolean }} [defaults]
 * @returns {RoutesDefinition}
 */
export const defineRoutes = (routes, defaults = {}) => Object.freeze({ routes, defaults });

/**
 * @param {RoutesMap} routes
 * @param {RouteConfig} defaults
 * @returns {RoutesMap}
 */
const localizeRoutes = (routes, defaults) => {
  const i18n = $APP.manifest.i18n;
  const defaultLocale = i18n?.defaultLocale || "en";
  const locales = i18n?.locales || [defaultLocale];
  const out = { ...routes };
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    for (const [path, cfg] of Object.entries(routes)) {
      const route = /** @type {RouteConfig} */ (cfg);
      out[`/${locale}${path === "/" ? "" : path}`] = {
        ...route,
        name: route.name ? `${route.name}-${locale}` : undefined,
        locale,
        ssg: route.ssg !== undefined ? route.ssg : (defaults.ssg ?? true),
        spa: route.spa,
      };
    }
  }
  return out;
};

/**
 * The route this runtime serves: on the web the route as declared, in a
 * native shell its `native` override merged over it, or nothing when the
 * override is `null`. The `native` key never reaches the table.
 *
 * @param {RouteConfig} route
 * @param {boolean} isNative
 * @returns {RouteConfig | null}
 */
const forRuntime = ({ native, ...route }, isNative) => {
  if (!isNative || native === undefined) return route;
  return native === null ? null : { ...route, ...normalizeRoute(native) };
};

/**
 * Register one or many definitions into `$APP.routes`. Must run before
 * `app:init`: the router compiles its table once; late registrations are
 * loudly warned instead of silently never matching.
 *
 * @param {RoutesDefinition | RoutesDefinition[]} definitions
 */
export const registerRoutes = (definitions) => {
  if (compiled)
    console.warn("[router] registerRoutes called after app:init; these routes will never match. Register before the app initializes (routes.js is auto-loaded at the right time)");
  const list = Array.isArray(definitions) ? definitions : [definitions];
  for (const definition of list) {
    if (!definition?.routes) continue;
    const { localized, ...defaults } = definition.defaults ?? {};
    const isNative = !!$APP.env?.isNative;
    /** @type {RoutesMap} */
    let expanded = {};
    for (const [path, value] of Object.entries(definition.routes)) {
      const route = forRuntime({ ...defaults, ...normalizeRoute(/** @type {RouteValue} */ (value)) }, isNative);
      if (route) expanded[path] = route;
    }
    if (localized) expanded = localizeRoutes(expanded, defaults);
    $APP.mergeCollection($APP.routes, expanded);
  }
};
