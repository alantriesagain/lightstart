/**
 * @lightstart/light/model/binder: the model as a sync target
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
 * `registerSyncBinder(modelBinder)` in the page that binds models. For a
 * controller written as a class, `liveRows(this, model, build)` is the same
 * query as a `sync:` entry, its rows read through `LiveRows`.
 */

import { resource } from "../controller/resource.ts";
import { writableRecord, writerOf } from "../controller/writers.ts";
import { effect, signal, untracked } from "../signals/index.ts";
import { isModelApi } from "./index.ts";
import { onChange } from "./changes.ts";
import { modelWarn } from "./events.ts";
import type { Controller } from "../controller/class.ts";
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

const copyQuery = (source: object): QueryOptions => {
  const query: QueryOptions = {};
  for (const [field, value] of Object.entries(source as Record<string, unknown>)) query[field] = value;
  return query;
};

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
  return liveQuery<T>(api, copyQuery(query), { name, eager, ready });
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

function followLive<T>(current: ModelQueryResource<T>, at: Following): ModelQueryResource<T> {
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
}

function followOne<V>(current: Resource<V>, at: Following): Resource<V> {
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
}

/** Keep `store`'s `key` mirroring `api`'s live query (an array property) or one row (any other), rebuilt when a `dependsOn` key changes. */
export const bindModelQuery = ({ store, key, prop, host, api, onValue, onError }: {
  store: StoreCore;
  key: string;
  prop: SyncProp;
  host: SyncHost;
  api: ModelApi;
  onValue?: (value: unknown, res: unknown) => void;
  onError?: (error: unknown) => void;
}): Binding => {
  const name = `${api.name}:${key}`;
  let stop: (() => void) | null = null;
  const at: Following = { offs: [], host, key, store, onValue: onValue ?? (() => {}), onError: onError ?? (() => {}), settle: () => {} };
  const loaded = new Promise<void>((resolve) => {
    at.settle = () => resolve();
  });

  const build = () => {
    for (const off of at.offs.splice(0)) off();
    stop?.();
    const given = prop.query;
    const query = (typeof given === "function" ? (given as (host: SyncHost) => unknown)(host) : (given ?? {})) as QueryOptions & { id?: unknown };
    const ready = prop.ready as ResourceOptions["ready"];
    if (prop.$type === "array") {
      const current = followLive(liveQuery(api, copyQuery(query), { name, eager: true, ready }), at);
      stop = () => current.dispose();
    } else {
      const current = followOne(singleRow(api, query, name, ready), at);
      stop = () => current.dispose();
    }
  };

  build();
  const depOffs: Array<() => void> = [];
  for (const dep of prop.dependsOn ?? []) depOffs.push(store.subscribe(dep, build));

  return {
    loaded,
    unbind: () => {
      for (const off of depOffs) off();
      for (const off of at.offs.splice(0)) off();
      stop?.();
      stop = null;
      const writer = writerOf(host.$queries);
      if (writer && writer.dropKey !== null) writer.dropKey(key);
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

/** A resource of rows, with a `total` when its source is a model query. */
type RowsResource = ModelQueryResource<Record<string, unknown>>;

const isRowObject = (value: unknown): boolean => typeof value === "object" && value !== null && !Array.isArray(value);

const rowId = (row: Record<string, unknown>): string | number | null => {
  const id = row.id;
  if (typeof id === "string" || typeof id === "number") return id;
  return null;
};

const idKey = (id: string | number | null): string => {
  if (typeof id === "number") return `n:${id}`;
  if (typeof id === "string") return `s:${id}`;
  return "null";
};

/**
 * The rows of a live query as a `Controller` subclass reads them. A query's
 * resource keeps its rows in a signal typed over `unknown`, which no
 * `Signal<T>` is natively, so the rows are read through this wrapper: its one
 * field is the unknown-typed signal the resource feeds, and `value` reads it
 * as `T[]`, the one cast, the way a view's `Prop<T>` reads its signal. `use`
 * points it at a resource (the next query when the options change), disposing
 * the one before.
 *
 * Given a `convert`, each row the resource answers is checked to be a non-null
 * object and handed to `convert` once, and the converted array is cached
 * against the source array it came from, so reading `value` twice converts
 * once. A row that is not an object or that `convert` answers `null` for is
 * skipped, counted in `skipped`, and reported once per row id through
 * `modelWarn` as `row_skipped`.
 */
export class LiveRows<T> {
  private res: RowsResource | null = null;
  private following: (() => void) | null = null;
  private readonly sig = signal<unknown>([]);
  private readonly convert: ((row: Record<string, unknown>) => T | null) | null;
  private readonly model: string;
  private source: unknown[] | null = null;
  private converted: T[] = [];
  private skippedCount = 0;
  private readonly warned: Set<string> = new Set();

  constructor(convert: ((row: Record<string, unknown>) => T | null) | null = null, model = "") {
    this.convert = convert;
    this.model = model;
  }

  /** The rows now; a render or an effect reading them follows the query. */
  get value(): T[] {
    return this.sig.value as T[];
  }

  /** The rows now, without tracking. */
  peek(): T[] {
    return this.sig.peek() as T[];
  }

  /** How many rows the last conversion skipped. */
  get skipped(): number {
    return this.skippedCount;
  }

  /** Whether a load is in flight. */
  get pending(): boolean {
    const res = this.res;
    return res !== null && res.pending.value;
  }

  /** The size of the whole match, past `limit`. */
  get total(): number {
    const res = this.res;
    return res !== null ? res.total : 0;
  }

  /** Follow `res` from now on, its rows replacing these as they land; the resource before is disposed. */
  use(res: RowsResource): void {
    this.drop();
    this.res = res;
    this.following = res.value.subscribe((rows) => {
      if (rows === undefined) return;
      this.ingest(rows);
    });
  }

  private ingest(rows: unknown[]): void {
    const convert = this.convert;
    if (convert === null) {
      this.sig.value = rows;
      return;
    }
    if (rows === this.source) {
      this.sig.value = this.converted;
      return;
    }
    this.source = rows;
    const converted: T[] = [];
    let skipped = 0;
    for (const value of rows) {
      if (!isRowObject(value)) {
        skipped++;
        this.warn(null);
        continue;
      }
      const row = value as Record<string, unknown>;
      const next = convert(row);
      if (next === null) {
        skipped++;
        this.warn(rowId(row));
        continue;
      }
      converted.push(next);
    }
    this.converted = converted;
    this.skippedCount = skipped;
    this.sig.value = converted;
  }

  private warn(id: string | number | null): void {
    const key = idKey(id);
    if (this.warned.has(key)) return;
    this.warned.add(key);
    modelWarn.emit({ type: "row_skipped", model: this.model, id });
  }

  /** The first load of the resource followed, settled either way; at once when there is none. */
  loaded(): Promise<void> {
    const res = this.res;
    return res === null ? Promise.resolve() : res.ensure().then(() => undefined, () => undefined);
  }

  /** Run the query again. */
  refresh(): Promise<void> {
    const res = this.res;
    return res === null ? Promise.resolve() : res.refresh().then(() => undefined);
  }

  /** Stop following; the rows stay as they were. */
  dispose(): void {
    this.drop();
  }

  private drop(): void {
    const following = this.following;
    if (following !== null) following();
    this.following = null;
    const res = this.res;
    if (res !== null) res.dispose();
    this.res = null;
  }
}

/**
 * The rows of a live query of `model` for `controller`: its options built by
 * `build` and built again whenever a signal `build` read changes, followed
 * from every `start()` until the controller is disposed. Registered through
 * `controller.$onStart`, the query starts with `start()`, against the stores
 * the run opened; its first load counts in `$ready`, and a second `start()`
 * follows it again. The signals `build` reads are declared above the field
 * that holds the rows.
 *
 * `convert` turns each row the query answers into `T` (a generated row class's
 * `static of`, say), with a `null` answer skipping the row; `rows.value` is
 * then `T[]` and `rows.skipped` counts the rows the last conversion skipped.
 */
export const liveRows = <T>(controller: Controller, model: ModelApi, build: () => ModelQueryOptions, convert?: (row: Record<string, unknown>) => T | null): LiveRows<T> => {
  const rows = new LiveRows<T>(convert ?? null, model.name);
  controller.$onStart(() => {
    const run = effect(() => {
      const options = build();
      untracked(() => rows.use(modelQuery<Record<string, unknown>>(model, options)));
    });
    controller.$own(() => {
      run.dispose();
      rows.dispose();
    });
    controller.$wait(rows.loaded());
  });
  return rows;
};
