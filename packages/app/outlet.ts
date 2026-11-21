/**
 * @file What a route's `<app-container>` draws: the matched route's chain
 * (top ancestor to matched leaf, through `parent`), split into drawn levels
 * that each hold a layout and a view, and the level a container at a given
 * position asks for. The root view's container draws level 0; a container in
 * a layout draws the view of the layout's own level; a container in a routed
 * view draws the next level. A grouping route (one with no view) is skipped,
 * its layout wrapping the level that follows. The resolution names no host,
 * so the web, markup and terminal containers share it.
 */

import type { MatchedRoute, RouteConfig } from "@lightstart/router/contracts.ts";

/** Where a container sits: the root (level 0 or a view's next level), or a layout's outlet at its own level. */
export interface OutletPosition {
  level: number;
  kind: "root" | "layout";
}

/** What a container draws: the layout to wrap the view in, the view, the props for the view, and the drawn level. */
export interface Outlet {
  layout: string | null;
  view: string | null;
  props: Record<string, unknown>;
  level: number;
}

/** One drawn level: a route with a view, its layout (from itself or a grouping ancestor), and its props. */
interface Level {
  level: number;
  layout: string | null;
  view: string;
  props: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const stringOf = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** The parameters of the matched path, path and query params as strings. */
export const paramsOf = (matched: MatchedRoute | null): Record<string, string> => {
  const params = matched !== null && isRecord(matched.params) ? matched.params : {};
  const out: Record<string, string> = {};
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
};

/** A route's view tag, or null when it only groups its children. */
export const viewOf = (route: RouteConfig | null): string | null => (route === null ? null : stringOf(route.view));

/** The matched leaf: the innermost route config the matcher answered. */
export const leafRoute = (matched: MatchedRoute | null): RouteConfig | null => {
  if (matched === null) return null;
  const inner = matched.matched;
  if (inner !== null && inner !== undefined) return inner.route;
  return matched.route;
};

/** The matched route's chain, top ancestor first and matched leaf last, through each config's `parent`. */
export const routeChain = (matched: MatchedRoute | null): RouteConfig[] => {
  const leaf = leafRoute(matched);
  if (leaf === null) return [];
  const chain: RouteConfig[] = [];
  let route: RouteConfig | null = leaf;
  while (route !== null) {
    chain.unshift(route);
    route = route.parent === undefined ? null : route.parent;
  }
  return chain;
};

/** The layouts a route declares: its own name, none for `layout: null`, or the app default for the top-level route. */
const layoutsOf = (route: RouteConfig, index: number, appLayout: string | null): string[] => {
  const own = route.layout;
  if (own === null) return [];
  const named = stringOf(own);
  if (named !== null) return [named];
  if (index === 0 && appLayout !== null) return [appLayout];
  return [];
};

/** A route's fixed props, a path or query param of the same name winning over each. */
const propsOf = (route: RouteConfig, params: Record<string, string>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const fixed = isRecord(route.props) ? route.props : {};
  for (const key of Object.keys(fixed)) out[key] = fixed[key];
  for (const key of Object.keys(params)) out[key] = params[key];
  return out;
};

/** The chain's drawn levels, grouping routes folded into the level that follows them. */
const drawnLevels = (matched: MatchedRoute | null, appLayout: string | null): Level[] => {
  const chain = routeChain(matched);
  const params = paramsOf(matched);
  const levels: Level[] = [];
  let pending: string[] = [];
  for (let index = 0; index < chain.length; index++) {
    const route = chain[index];
    const layouts = layoutsOf(route, index, appLayout);
    const view = viewOf(route);
    if (view === null) {
      for (const layout of layouts) pending.push(layout);
      continue;
    }
    let layout: string | null = layouts.length > 0 ? layouts[layouts.length - 1] : null;
    if (layout === null && route.layout !== null && pending.length > 0) layout = pending[pending.length - 1];
    pending = [];
    levels.push({ level: levels.length, layout, view, props: propsOf(route, params) });
  }
  return levels;
};

/** What the container at `position` draws for the matched route, the app's default layout applying to the top-level route only. */
export const resolveOutlet = (matched: MatchedRoute | null, position: OutletPosition, appLayout: string | null = null): Outlet => {
  const levels = drawnLevels(matched, appLayout);
  for (const level of levels) {
    if (level.level !== position.level) continue;
    return {
      layout: position.kind === "layout" ? null : level.layout,
      view: level.view,
      props: level.props,
      level: level.level,
    };
  }
  return { layout: null, view: null, props: {}, level: position.level };
};

/** A parameter as the type its view declares for that prop: a number when finite, a boolean for "", "true", "1" and "false", "0"; otherwise the string. */
export const convertParam = (value: string, type: string | null): unknown => {
  if (type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (type === "boolean") {
    if (value === "" || value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return value;
  }
  return value;
};
