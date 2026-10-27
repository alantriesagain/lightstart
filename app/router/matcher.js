/**
 * @bootstrapp/router: Route Matching
 * URLPattern-based route matching utilities.
 */

/**
 * @import {
 *   RouteConfig, RouteValue, RoutesMap, CompiledRoute,
 *   MatchedRoute, FlattenedRoutes,
 * } from "./types.js"
 */

/**
 * Build the URLPattern path string for a route, expanding optional
 * named-param suffixes.
 *
 * @param {RouteConfig} route
 * @returns {string}
 */
export function createPatternString(route) {
  let path = route.path ?? "";
  if (route.namedParams && route.namedParams.length > 0) {
    const optionalSegments = route.namedParams
      .map((param) => `/${param}/:${param}`)
      .join("");
    path += `(${optionalSegments})?`;
  }
  return path;
}

/**
 * Walk nested route maps and produce a flat `{ path → RouteConfig }`
 * map plus a `{ name → path }` lookup.
 *
 * @param {RoutesMap} routes
 * @param {string} [basePath]
 * @param {RouteConfig | null} [parentRoute]
 * @returns {FlattenedRoutes}
 */
export function flattenRoutes(routes, basePath = "", parentRoute = null) {
  /** @type {Record<string, RouteConfig>} */
  const flatRoutes = {};
  /** @type {Record<string, string>} */
  const namedRoutes = {};

  for (const path in routes) {
    const raw = routes[path];
    /** @type {RouteConfig} */
    const route =
      typeof raw === "function"
        ? /** @type {RouteConfig} */ ({ component: raw })
        : { ...raw };
    const fullPath = (basePath + path).replace(/\/+/g, "/");

    route.path = fullPath || "/";
    route.parent = parentRoute;
    flatRoutes[route.path] = route;

    if (route.name) {
      if (namedRoutes[route.name])
        console.warn(`[router] Duplicate route name: ${route.name}`);

      namedRoutes[route.name] = route.path;
    }

    if (route.routes) {
      const { flatRoutes: childFlatRoutes, namedRoutes: childNamedRoutes } =
        flattenRoutes(route.routes, fullPath, route);
      Object.assign(flatRoutes, childFlatRoutes);
      Object.assign(namedRoutes, childNamedRoutes);
    }
  }
  return { flatRoutes, namedRoutes };
}

/**
 * Pre-compile route patterns. Results are sorted longest-first so
 * specific paths win during match.
 *
 * @param {Record<string, RouteConfig>} flatRoutes
 * @param {(err: { type: string, path: string, error: unknown }) => void} [onError]
 * @returns {CompiledRoute[]}
 */
export function compileRoutes(flatRoutes, onError) {
  /** @type {CompiledRoute[]} */
  const compiled = [];

  for (const path in flatRoutes) {
    const route = flatRoutes[path];
    const patternString = createPatternString(route);
    try {
      const pattern = new URLPattern({ pathname: patternString });
      compiled.push({ pattern, route, originalPath: path });
    } catch (e) {
      onError?.({ type: "pattern_error", path: patternString, error: e });
    }
  }

  compiled.sort((a, b) => {
    const aParts = a.originalPath.split("/").length;
    const bParts = b.originalPath.split("/").length;
    return bParts - aParts;
  });

  return compiled;
}

/**
 * Find the first route whose pattern matches `pathname`. Returns the
 * matched route + extracted params, or `null` if none match.
 *
 * @param {CompiledRoute[]} routes
 * @param {string} pathname
 * @returns {MatchedRoute | null}
 */
export function matchRoute(routes, pathname, extraParams = {}) {
  for (const { pattern, route } of routes) {
    const match = pattern.exec({ pathname });

    if (match) {
      const params = /** @type {Record<string, string>} */ (
        match.pathname.groups || {}
      );
      const combinedParams = { ...extraParams, ...params };

      const component =
        typeof route === "function"
          ? route
          : typeof route.component === "function"
            ? route.component(combinedParams)
            : route.component;

      /** @type {MatchedRoute} */
      const result = {
        route,
        params: combinedParams,
        name: route.name,
        component,
        template: route.template,
      };

      if (route.parent) {
        result.route = route.parent;
        result.template = route.parent.template;
        const parentComp = route.parent.component;
        result.component =
          typeof parentComp === "function"
            ? parentComp(combinedParams)
            : parentComp;
        result.matched = {
          route,
          params: combinedParams,
          path: route.path,
          name: route.name,
          component,
          template: route.template,
        };
      }
      return result;
    }
  }
  return null;
}
