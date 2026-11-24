/**
 * @file Route variants per language: an app that declares several locales
 * answers every route in each of them, the default with no prefix and the
 * others under `/<lang>`. The expansion keeps each route's view, layout, props
 * and nested children, stamps the variant's locale, and names a non-default
 * variant `<name>@<lang>` so the base name still names the default path.
 */

import { withLocale } from "@lightstart/router/locale";
import type { RouteConfig, RoutesMap, RouteValue } from "@lightstart/router/contracts.ts";

/** What an expansion needs: the languages and the one that carries no prefix. */
export interface LocaleExpansion {
  /** Every language the app ships. */
  locales: readonly string[];
  /** The language that carries no path prefix. */
  defaultLocale: string;
}

/** The name a route takes in a locale: the base name for the default, `<name>@<lang>` otherwise. */
export const localizedRouteName = (name: string, locale: string | null): string => (locale === null ? name : `${name}@${locale}`);

const cloneFor = (value: RouteValue, locale: string | null): RouteValue => {
  if (typeof value === "function") return locale === null ? value : { component: value, locale };
  const route: RouteConfig = { ...(value as RouteConfig) };
  if (locale !== null) route.locale = locale;
  if (typeof route.name === "string") route.name = localizedRouteName(route.name, locale);
  if (route.routes !== undefined) {
    const nested: RoutesMap = {};
    for (const key of Object.keys(route.routes)) nested[key] = cloneFor(route.routes[key], locale);
    route.routes = nested;
  }
  return route;
};

const prefixed = (key: string, locale: string, config: LocaleExpansion): string => {
  if (!key.startsWith("/")) return key;
  return withLocale(key, locale, config.locales, config.defaultLocale);
};

/**
 * Expand `routes` into one variant per non-default locale. A route with
 * `localized: false` keeps its single shape. With fewer than two locales the
 * table is answered as written.
 */
export const expandRoutes = (routes: RoutesMap, config: LocaleExpansion): RoutesMap => {
  if (config.locales.length < 2) return routes;
  const expanded: RoutesMap = {};
  for (const key of Object.keys(routes)) {
    const raw = routes[key];
    expanded[key] = cloneFor(raw, null);
    const off = typeof raw === "object" && raw !== null && (raw as RouteConfig).localized === false;
    if (off) continue;
    for (const locale of config.locales) {
      if (locale === config.defaultLocale) continue;
      expanded[prefixed(key, locale, config)] = cloneFor(raw, locale);
    }
  }
  return expanded;
};
