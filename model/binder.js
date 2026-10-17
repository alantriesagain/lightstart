/**
 * @bootstrapp/light/model/binder: the model as a sync target
 * A property bound to a model's api (`Model.x`), on a controller or a view, is
 * one live query mirrored into the host's store key: an array property runs
 * `modelQuery()`, any other keeps one row (`query.id`, or a `where`) current.
 * `query` is an object or `(host) => object`; `dependsOn` names the host
 * properties whose change rebuilds it. The resource lands on
 * `host.$queries[key]`. `modelQuery()` is one `query()` through `resource()`
 * that re-runs itself, coalesced per tick, when a change lands on its model or
 * on an included relation's model; every option a query takes is live-safe,
 * `limit` and `offset` included, and `total` follows the whole match.
 * `modelBinder` hands all of this to light's sync binding:
 * `registerSyncBinder(modelBinder)` in the page that binds models.
 */

import { resource } from "../controller/resource.ts";
import { isModelApi } from "./index.js";
import { onChange } from "./changes.js";

/** @import { Resource, ResourceOptions, Store, SyncBinder, SyncProp } from "../controller/types.ts" */
/** @import { ModelApi, ModelQueryOptions, QueryOptions } from "./types.ts" */

const swallow = () => {};

/**
 * The models an include can point at: the declared target, every target of
 * a polymorphic relation, nothing for a wildcard.
 * @param {ModelApi} api
 * @param {string} include
 * @returns {string[]}
 */
const includeTargets = (api, include) => {
  const target = /** @type {{ targetModel?: string | string[] } | undefined} */ (api.schema?.[include])?.targetModel;
  if (Array.isArray(target)) return target;
  return typeof target === "string" && target !== "*" ? [target] : [];
};

/**
 * @template {Record<string, unknown>} T
 * @param {ModelApi} api
 * @param {ModelQueryOptions} [opts]
 * @returns {Resource<T[]> & { readonly total: number }}
 */
export const modelQuery = (api, opts = {}) => {
  const { name = api.name, eager = true, ready, ...query } = opts;
  let total = 0;
  let settled = false;
  let stale = false;
  let scheduled = false;
  const refresh = () => {
    if (!settled) {
      stale = true;
      return;
    }
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      res.refresh().catch(swallow);
    });
  };
  const res = resource(async () => {
    stale = false;
    const page = await api.query(query);
    total = page.total;
    settled = true;
    if (stale) queueMicrotask(refresh);
    return /** @type {T[]} */ (page.rows);
  }, { name: `query:${name}`, eager, ready });

  const offs = [onChange(api.name, undefined, refresh)];
  for (const include of query.includes ?? [])
    for (const target of includeTargets(api, include)) offs.push(onChange(target, undefined, refresh));

  const disposeResource = res.dispose;
  const live = Object.defineProperty(res, "total", { get: () => total, enumerable: true });
  live.dispose = () => {
    for (const off of offs.splice(0)) off();
    disposeResource();
  };
  return /** @type {Resource<T[]> & { readonly total: number }} */ (live);
};

/** @type {WeakMap<object, number>} */
const loadsInFlight = new WeakMap();

/**
 * Count the loads bound to a store, so its `dataPending` (when it declares
 * one) stays true while any overlapping load is in flight.
 * @param {Store} store
 * @param {1 | -1} step
 */
const countLoad = (store, step) => {
  const count = Math.max(0, (loadsInFlight.get(store) ?? 0) + step);
  loadsInFlight.set(store, count);
  if (store.keys().includes("dataPending")) store.set("dataPending", count > 0);
};

/**
 * @param {ModelApi} api
 * @param {QueryOptions & { id?: unknown }} query
 * @param {string} name
 * @param {ResourceOptions["ready"]} ready
 */
const singleRow = (api, query, name, ready) => {
  const { id, ...rest } = query;
  const res = resource(
    () => (id != null ? api.get(/** @type {string} */ (id), rest) : rest.where ? api.get(rest) : Promise.resolve(null)),
    { name: `get:${name}`, eager: true, ready },
  );
  const off = onChange(api.name, undefined, () => res.invalidate());
  const dispose = res.dispose;
  res.dispose = () => {
    off();
    dispose();
  };
  return res;
};

/**
 * @param {{
 *   store: Store,
 *   key: string,
 *   prop: SyncProp & { ready?: unknown },
 *   host: Record<string, any>,
 *   api: ModelApi,
 *   onValue?: (value: unknown, res: Resource<any>) => void,
 *   onError?: (error: unknown) => void,
 * }} args
 * @returns {{ unbind: () => void, loaded: Promise<void> }}
 */
export const bindModelQuery = ({ store, key, prop, host, api, onValue, onError }) => {
  const name = `${api.name}:${key}`;
  /** @type {Resource<any> | null} */
  let res = null;
  /** @type {Array<() => void>} */
  const offs = [];
  /** @type {() => void} */
  let settle = () => {};
  const loaded = new Promise((resolve) => { settle = () => resolve(undefined); });

  const build = () => {
    for (const off of offs.splice(0)) off();
    res?.dispose();
    const query = /** @type {QueryOptions & { id?: unknown }} */ (typeof prop.query === "function" ? prop.query(host) : (prop.query ?? {}));
    const ready = /** @type {ResourceOptions["ready"]} */ (prop.ready);
    res = prop.$type === "array"
      ? modelQuery(api, { ...query, name, ready })
      : singleRow(api, query, name, ready);
    const current = res;
    (host.$queries ??= {})[key] = current;
    offs.push(current.value.subscribe((value) => {
      if (value === undefined) return;
      store.set(key, value);
      if (onValue) onValue(value, current);
    }));
    if (onError) offs.push(current.error.subscribe((error) => { if (error) onError(error); }));
    countLoad(store, 1);
    current.ensure().catch(swallow).finally(() => {
      countLoad(store, -1);
      settle();
    });
  };

  build();
  const depOffs = (prop.dependsOn ?? []).map((dep) => store.subscribe(dep, build));

  return {
    loaded,
    unbind: () => {
      for (const off of depOffs) off();
      for (const off of offs.splice(0)) off();
      res?.dispose();
      res = null;
      if (host.$queries) delete host.$queries[key];
    },
  };
};

/**
 * The model as a sync target: light's binding hands a property bound to a
 * model api (or a thunk answering one) to `bindModelQuery`, with its `query`
 * and `dependsOn`.
 * @type {SyncBinder}
 */
export const modelBinder = {
  test: isModelApi,
  options: ["query", "dependsOn"],
  bind: ({ store, key, prop, host, target }) => bindModelQuery({ store, key, prop, host, api: /** @type {ModelApi} */ (target) }),
};
