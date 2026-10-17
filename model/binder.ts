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
import { isModelApi } from "./index.ts";
import { onChange } from "./changes.ts";
import type { Resource, ResourceOptions, StoreCore, SyncBinder, SyncHost, SyncProp } from "../controller/types.ts";
import type { ModelApi, ModelQueryOptions, ModelQueryResource, QueryOptions } from "./types.ts";

const swallow = () => {};

const includeTargets = (api: ModelApi, include: string): string[] => {
  const target = (api.schema?.[include] as { targetModel?: string | string[] } | undefined)?.targetModel;
  if (Array.isArray(target)) return target;
  return typeof target === "string" && target !== "*" ? [target] : [];
};

/** A live query of `api`: a `resource()` over `api.query()` that refetches, coalesced per tick, when its model or an included model changes. */
export const modelQuery = <T extends Record<string, unknown>>(api: ModelApi, opts: ModelQueryOptions = {}): ModelQueryResource<T> => {
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
  const res = resource(async (): Promise<T[]> => {
    stale = false;
    const page = await api.query(query);
    total = page.total;
    settled = true;
    if (stale) queueMicrotask(refresh);
    return page.rows as T[];
  }, { name: `query:${name}`, eager, ready });

  const offs = [onChange(api.name, undefined, refresh)];
  for (const include of query.includes ?? [])
    for (const target of includeTargets(api, include)) offs.push(onChange(target, undefined, refresh));

  const disposeResource = res.dispose;
  const live = Object.defineProperty(res, "total", { get: () => total, enumerable: true }) as ModelQueryResource<T>;
  live.dispose = () => {
    for (const off of offs.splice(0)) off();
    disposeResource();
  };
  return live;
};

const loadsInFlight: WeakMap<object, number> = new WeakMap();

const countLoad = (store: StoreCore, step: 1 | -1) => {
  const count = Math.max(0, (loadsInFlight.get(store) ?? 0) + step);
  loadsInFlight.set(store, count);
  if (store.keys().includes("dataPending")) store.set("dataPending", count > 0);
};

const singleRow = (api: ModelApi, query: QueryOptions & { id?: unknown }, name: string, ready: ResourceOptions["ready"]) => {
  const { id, ...rest } = query;
  const res = resource(
    () => (id != null ? api.get(id as string, rest) : rest.where ? api.get(rest) : Promise.resolve(null)),
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

/** Keep `store`'s `key` mirroring `api`'s live query (an array property) or one row (any other), rebuilt when a `dependsOn` key changes. */
export const bindModelQuery = ({ store, key, prop, host, api, onValue, onError }: {
  store: StoreCore;
  key: string;
  prop: SyncProp & { ready?: unknown };
  host: SyncHost;
  api: ModelApi;
  onValue?: (value: unknown, res: unknown) => void;
  onError?: (error: unknown) => void;
}): { unbind: () => void; loaded: Promise<void> } => {
  const name = `${api.name}:${key}`;
  let res: { dispose(): void } | null = null;
  const offs: Array<() => void> = [];
  let settle = () => {};
  const loaded = new Promise<void>((resolve) => {
    settle = () => resolve(undefined);
  });

  const follow = <V>(current: Resource<V>) => {
    res = current;
    let queries = host.$queries as Record<string, unknown> | undefined;
    if (!queries) {
      queries = {};
      host.$queries = queries;
    }
    queries[key] = current;
    offs.push(current.value.subscribe((value) => {
      if (value === undefined) return;
      store.set(key, value);
      if (onValue) onValue(value, current);
    }));
    if (onError) offs.push(current.error.subscribe((error) => {
      if (error) onError(error);
    }));
    countLoad(store, 1);
    current.ensure().catch(swallow).finally(() => {
      countLoad(store, -1);
      settle();
    });
  };

  const build = () => {
    for (const off of offs.splice(0)) off();
    res?.dispose();
    const query = (typeof prop.query === "function" ? prop.query(host) : (prop.query ?? {})) as QueryOptions & { id?: unknown };
    const ready = prop.ready as ResourceOptions["ready"];
    if (prop.$type === "array") follow(modelQuery(api, { ...query, name, ready }));
    else follow(singleRow(api, query, name, ready));
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
      const queries = host.$queries as Record<string, unknown> | undefined;
      if (queries) delete queries[key];
    },
  };
};

/**
 * The model as a sync target: light's binding hands a property bound to a
 * model api (or a thunk answering one) to `bindModelQuery`, with its `query`
 * and `dependsOn`.
 */
export const modelBinder: SyncBinder = {
  test: isModelApi,
  options: ["query", "dependsOn"],
  bind({ store, key, prop, host, target }) {
    return bindModelQuery({ store, key, prop, host, api: target as ModelApi });
  },
};
