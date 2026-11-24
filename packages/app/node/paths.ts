/**
 * @file The concrete paths an app's routes answer: a static route is its own
 * path, and a route with parameters is filled from the values its `params`
 * lists. Wildcards, routes marked `spa: true` and redirects have no concrete
 * path, so they are left out. The build's sitemap and prerendering read this.
 */

import type { RoutesMap } from "@lightstart/router";
import { withLocale } from "@lightstart/router/locale";

/** How a build lists each concrete path: in every language the app ships, when it ships several. */
export interface PathsOptions {
  /** The languages the app ships. */
  locales?: readonly string[];
  /** The language that carries no path prefix. */
  defaultLocale?: string;
}

/** The entries a route's `params` answers. */
type ParamsAnswer = Array<Record<string, string>>;

/** How a route lists the values of its path's parameters. */
type ParamsOf = () => ParamsAnswer | Promise<ParamsAnswer>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const segmentsOf = (path: string): string[] => path.split("/");

const isWildcard = (path: string): boolean => segmentsOf(path).some((segment) => segment === "*" || (segment.startsWith(":") && segment.endsWith("*")));

const parameterNames = (path: string): string[] => {
  const names: string[] = [];
  for (const segment of segmentsOf(path)) {
    if (segment.startsWith(":") && segment.length > 1 && !segment.endsWith("*")) names.push(segment.slice(1));
  }
  return names;
};

const fillPath = (path: string, values: Record<string, unknown>): string | null => {
  const segments: string[] = [];
  for (const segment of segmentsOf(path)) {
    if (segment.startsWith(":") && segment.length > 1 && !segment.endsWith("*")) {
      const value = values[segment.slice(1)];
      if (typeof value !== "string") return null;
      segments.push(encodeURIComponent(value));
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
};

const collect = async (routes: RoutesMap, base: string, out: Set<string>, options: PathsOptions, inherited: boolean): Promise<void> => {
  const locales = options.locales ?? [];
  const defaultLocale = options.defaultLocale ?? "en";
  const add = (path: string, localized: boolean): void => {
    out.add(path);
    if (!localized || locales.length < 2) return;
    for (const locale of locales) {
      if (locale !== defaultLocale) out.add(withLocale(path, locale, locales, defaultLocale));
    }
  };
  for (const key of Object.keys(routes)) {
    const value = routes[key];
    const route = isRecord(value) ? value : null;
    const path = (base + key).replace(/\/+/g, "/") || "/";
    const localized = inherited && (route === null || route.localized !== false);

    if (route === null) {
      add(path, localized);
      continue;
    }

    const grouping = isRecord(route.routes) && typeof route.view !== "string";
    const skipped = grouping || typeof route.redirect === "string" || route.spa === true || isWildcard(path);
    if (!skipped) {
      const names = parameterNames(path);
      if (names.length === 0) {
        add(path, localized);
      } else if (typeof route.params === "function") {
        const answer = await (route.params as ParamsOf)();
        if (Array.isArray(answer)) {
          for (const entry of answer) {
            if (!isRecord(entry)) continue;
            const filled = fillPath(path, entry);
            if (filled !== null) add(filled, localized);
          }
        }
      }
    }

    if (isRecord(route.routes)) await collect(route.routes as RoutesMap, path, out, options, localized);
  }
};

/** Every concrete path of `routes`, in each of the app's languages when it ships several; sorted and unique. */
export const pathsOf = async (routes: RoutesMap, options: PathsOptions = {}): Promise<string[]> => {
  const out = new Set<string>();
  await collect(routes, "", out, options, true);
  return [...out].sort();
};
