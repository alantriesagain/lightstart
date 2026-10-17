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
import { writableRecord, writerOf } from "../controller/writers.ts";
import { isModelApi } from "./index.ts";
import { onChange } from "./changes.ts";
import type { Binding, Resource, ResourceOptions, StoreCore, SyncBinder, SyncHost, SyncProp } from "../controller/types.ts";
import type { ModelApi, ModelQueryOptions, ModelQueryResource, QueryOptions } from "./types.ts";

const includeTargets = (api: ModelApi, include: string): string[] => {
  const target = (api.schema?.[include] as { targetModel?: string | string[] } | undefined)?.targetModel;
  if (Array.isArray(target)) return target;
  return typeof target === "string" && target !== "*" ? [target] : [];
};

interface QueryKnobs {
  name: string;
  eager: boolean;
  ready: ResourceOptions["ready"];
}

const liveQuery = <T extends Record<string, unknown>>(api: ModelApi, query: QueryOptions, { name, eager, ready }: QueryKnobs): ModelQueryResource<T> => {
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
      res.refresh().catch(() => {});
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

  res.own(onChange(api.name, undefined, refresh));
  for (const include of query.includes ?? [])
    for (const target of includeTargets(api, include)) res.own(onChange(target, undefined, refresh));

  return {
    name: res.name,
    value: res.value,
    pending: res.pending,
    error: res.error,
    ensure: () => res.ensure(),
    refresh: () => res.refresh(),
    invalidate: () => res.invalidate(),
    mutate: (updater) => res.mutate(updater),
    peek: () => res.peek(),
    subscribe: (cb) => res.subscribe(cb),
    own: (teardown) => res.own(teardown),
    dispose: () => res.dispose(),
    get total() {
      return total;
    },
  };
};

/** A live query of `api`: a `resource()` over `api.query()` that refetches, coalesced per tick, when its model or an included model changes. */
export const modelQuery = <T extends Record<string, unknown>>(api: ModelApi, opts: ModelQueryOptions = {}): ModelQueryResource<T> => {
  const { name = api.name, eager = true, ready, ...query } = opts;
  return liveQuery<T>(api, query, { name, eager, ready });
};

const loadsInFlight: WeakMap<object, number> = new WeakMap();

const countLoad = (store: StoreCore, step: 1 | -1) => {
  const count = Math.max(0, (loadsInFlight.get(store) ?? 0) + step);
  loadsInFlight.set(store, count);
  if (store.keys().includes("dataPending")) store.set("dataPending", count > 0);
};

const singleRow = (api: ModelApi, query: QueryOptions & { id?: unknown }, name: string, ready: ResourceOptions["ready"]) => {
  const { id } = query;
  const rest: QueryOptions = {};
  for (const [field, value] of Object.entries(query)) if (field !== "id") rest[field] = value;
  const res = resource(
    (): Promise<unknown> => (id != null ? api.get(id as string, rest) : rest.where ? api.get(rest) : Promise.resolve(null)),
    { name: `get:${name}`, eager: true, ready },
  );
  res.own(onChange(api.name, undefined, () => res.invalidate()));
  return res;
};

interface Following {
  offs: Array<() => void>;
  host: SyncHost;
  key: string;
  store: StoreCore;
  onValue: (value: unknown, res: unknown) => void;
  onError: (error: unknown) => void;
  settle: () => void;
}

const follow = <V>(current: Resource<V>, at: Following): Resource<V> => {
  let writer = writerOf(at.host.$queries);
  if (writer === undefined) {
    writer = writableRecord();
    at.host.$queries = writer.record;
  }
  writer.writeKey(at.key, current);
  at.offs.push(current.value.subscribe((value) => {
    if (value === undefined) return;
    at.store.set(at.key, value);
    at.onValue(value, current);
  }));
  at.offs.push(current.error.subscribe((error) => {
    if (error) at.onError(error);
  }));
  countLoad(at.store, 1);
  current.ensure().catch(() => {}).finally(() => {
    countLoad(at.store, -1);
    at.settle();
  });
  return current;
};

/** Keep `store`'s `key` mirroring `api`'s live query (an array property) or one row (any other), rebuilt when a `dependsOn` key changes. */
export const bindModelQuery = ({ store, key, prop, host, api, onValue, onError }: {
  store: StoreCore;
  key: string;
  prop: SyncProp;
  host: SyncHost;
  api: ModelApi;
  onValue?: (value: unknown, res: unknown) => void;
  onError?: (error: unknown) => void;
}): { unbind: () => void; loaded: Promise<void> } => {
  const name = `${api.name}:${key}`;
  let res: { dispose(): void } | null = null;
  const at: Following = { offs: [], host, key, store, onValue: onValue ?? (() => {}), onError: onError ?? (() => {}), settle: () => {} };
  const loaded = new Promise<void>((resolve) => {
    at.settle = () => resolve();
  });

  const build = () => {
    for (const off of at.offs.splice(0)) off();
    res?.dispose();
    const given = prop.query;
    const query = (typeof given === "function" ? (given as (host: SyncHost) => unknown)(host) : (given ?? {})) as QueryOptions & { id?: unknown };
    const ready = prop.ready as ResourceOptions["ready"];
    if (prop.$type === "array") res = follow(liveQuery(api, query, { name, eager: true, ready }), at);
    else res = follow(singleRow(api, query, name, ready), at);
  };

  build();
  const depOffs: Array<() => void> = [];
  for (const dep of prop.dependsOn ?? []) depOffs.push(store.subscribe(dep, build));

  return {
    loaded,
    unbind: () => {
      for (const off of depOffs) off();
      for (const off of at.offs.splice(0)) off();
      res?.dispose();
      res = null;
      const writer = writerOf(host.$queries);
      if (writer) writer.dropKey(key);
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
  bind({ store, key, prop, host, target }): Binding {
    return bindModelQuery({ store, key, prop, host, api: target as ModelApi });
  },
};
