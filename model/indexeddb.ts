/**
 * @bootstrapp/light/model/indexeddb: the IndexedDB storage adapter. One
 * object store per model, an index per
 * `index: true` / `unique: true` field, booleans and dates encoded so the
 * indexes can hold them. `query` reads one index when the `where` names an
 * indexed field and matches the rest in memory. A model that names this
 * adapter as its `$shadow` gets a store here too, under its own name, beside
 * the models that live here. Importing it registers nothing:
 * `registerStorageAdapter("indexeddb", IndexedDBAdapter)` where the store is
 * built.
 */

import { IDB_ERROR, IDB_LOG, IDB_WARN } from "./events.ts";
import { buildQueryResult, validateQueryOptions } from "./query-builder.ts";
import { modelBus } from "./config.ts";

import type { ModelField, ModelSchema, QueryOptions, Row, StorageAdapter, WhereClause } from "./types.ts";

type IdbAdapter = StorageAdapter & {
  db: IDBDatabase | null,
  connectionPromise: Promise<IDBDatabase> | null,
  models: Record<string, ModelSchema>,
  name: string,
  version: number | "auto",
  storePrefix?: string,
  isDefaultAdapter?: boolean,
  _storeName(model: string): string,
  _modelBelongs(modelName: string, schema: ModelSchema | undefined): boolean,
  _expectedStores(): string[],
  _createObjectStore(db: IDBDatabase, storeName: string, schema: ModelSchema): void,
  _updateObjectStore(store: IDBObjectStore, schema: ModelSchema): void,
  encode(model: string, row: Row): Row,
  decode(model: string, row: Row): Row,
};

const isValidKey = (value: unknown): value is IDBValidKey =>
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value)) ||
  value instanceof Date;

const RANGE_OPS: Record<string, "lower" | "upper" | undefined> = { ">": "lower", ">=": "lower", "<": "upper", "<=": "upper" };

const BOOLEAN_TO_STORAGE: Record<string, 0 | 1> = { true: 1, false: 0 };
const STORAGE_TO_BOOLEAN: Record<string | number, boolean> = { 1: true, 0: false, true: true, false: false };

const fieldsOf = (schema: ModelSchema | undefined): Array<[string, ModelField]> =>
  Object.entries(schema ?? {})
    .filter(([field]) => !field.startsWith("$"))
    .map(([field, def]): [string, ModelField] => [field, def as ModelField]);

/**
 * Pick one index that can narrow this query.
 *
 * Deliberately modest: it finds the first indexed field the `where` mentions and
 * turns that one condition into a key range. Every condition is still applied in
 * JS afterwards, so a poor plan costs speed and never correctness.
 *
 * An array field gets a `multiEntry` index, so "contains" is a plain lookup.
 */
export const planIndex = (schema: ModelSchema | undefined, where: WhereClause | undefined): { field: string, range: IDBKeyRange, multiEntry: boolean } | null => {
  if (!schema || !where) return null;
  for (const [field, condition] of Object.entries(where)) {
    const def: ModelField | undefined = schema[field];
    if (!def || (def.index !== true && def.unique !== true)) continue;
    const multiEntry = def.$type === "array";
    const encoded = (v: unknown): unknown => (def.$type === "boolean" && typeof v === "boolean" ? BOOLEAN_TO_STORAGE[String(v)] : v);

    if (typeof condition !== "object" || condition === null) {
      const value = encoded(condition);
      if (!isValidKey(value)) continue;
      return { field, range: IDBKeyRange.only(value), multiEntry };
    }

    const entries = Object.entries(condition).map(([op, value]: [string, unknown]): [string, unknown] => [op, encoded(value)]);
    const equality = entries.find(([op, value]) => (op === "has" || op === "=") && isValidKey(value));
    if (equality) return { field, range: IDBKeyRange.only(equality[1] as IDBValidKey), multiEntry };

    let lower: { value: IDBValidKey, open: boolean } | undefined;
    let upper: { value: IDBValidKey, open: boolean } | undefined;
    for (const [op, value] of entries) {
      if (!RANGE_OPS[op] || !isValidKey(value)) continue;
      if (RANGE_OPS[op] === "lower") lower = { value, open: op === ">" };
      else upper = { value, open: op === "<" };
    }
    if (lower && upper)
      return { field, range: IDBKeyRange.bound(lower.value, upper.value, lower.open, upper.open), multiEntry };
    if (lower) return { field, range: IDBKeyRange.lowerBound(lower.value, lower.open), multiEntry };
    if (upper) return { field, range: IDBKeyRange.upperBound(upper.value, upper.open), multiEntry };
  }
  return null;
};

const done = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const tx = async <T>(adapter: IdbAdapter, model: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const db = (await adapter.init()) as IDBDatabase;
  const transaction = db.transaction(adapter._storeName(model), mode);
  const pending = work(transaction.objectStore(adapter._storeName(model)));
  pending.catch(() => {});
  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
  });
  return pending;
};

const IndexedDBAdapter: StorageAdapter = {
  type: "indexeddb",

  db: null,
  connectionPromise: null,

  async init(this: IdbAdapter) {
    if (this.version !== "auto") this.version = Number(this.version) || 1;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      const request = this.version === "auto" ? indexedDB.open(this.name) : indexedDB.open(this.name, this.version);

      request.onerror = () => {
        this.connectionPromise = null;
        if (request.error?.name === "VersionError" && this.version !== "auto") {
          this.version = "auto";
          this.init().then((db) => resolve(db as IDBDatabase), reject);
          return;
        }
        modelBus().emit(IDB_ERROR, { type: "open_failed", error: request.error });
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        const db = request.result;
        const missing = this._expectedStores().filter((s) => !db.objectStoreNames.contains(s));
        if (missing.length) {
          const nextVersion = db.version + 1;
          modelBus().emit(IDB_LOG, { type: "upgrading", name: this.name, version: nextVersion, missing });
          db.close();
          this.connectionPromise = null;
          this.version = nextVersion;
          this.init().then((reopened) => resolve(reopened as IDBDatabase), reject);
          return;
        }
        this.db = db;
        this.version = db.version;
        db.onversionchange = () => {
          modelBus().emit(IDB_WARN, { type: "version_changed", name: this.name });
          this.close();
        };
        modelBus().emit(IDB_LOG, { type: "connected", name: this.name, version: this.version });
        resolve(db);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        const transaction = request.transaction;
        for (const [modelName, schema] of Object.entries(this.models)) {
          if (!this._modelBelongs(modelName, schema)) continue;
          const storeName = this._storeName(modelName);
          if (!db.objectStoreNames.contains(storeName)) this._createObjectStore(db, storeName, schema);
          else if (transaction) this._updateObjectStore(transaction.objectStore(storeName), schema);
        }
      };
    });

    return this.connectionPromise;
  },

  _storeName(this: IdbAdapter, model: string) {
    if (this.storePrefix && model.startsWith(this.storePrefix)) return model.slice(this.storePrefix.length);
    return model;
  },

  _modelBelongs(this: IdbAdapter, modelName: string, schema: ModelSchema | undefined) {
    if (!schema || modelName.startsWith("$")) return false;
    const adapterPreference = schema.$adapter;
    if (this.storePrefix) return modelName.startsWith(this.storePrefix);
    if (schema.$extension) return false;
    if (schema.$shadow === this.type) return true;
    if (this.isDefaultAdapter) return !(adapterPreference && adapterPreference !== "indexeddb");
    return adapterPreference === "indexeddb";
  },

  _expectedStores(this: IdbAdapter) {
    const stores: string[] = [];
    for (const [modelName, schema] of Object.entries(this.models || {}))
      if (this._modelBelongs(modelName, schema)) stores.push(this._storeName(modelName));
    return stores;
  },

  _createObjectStore(this: IdbAdapter, db: IDBDatabase, storeName: string, schema: ModelSchema) {
    const idField: ModelField | undefined = schema.id;
    const store = db.createObjectStore(storeName, { keyPath: "id", autoIncrement: !idField || idField.$type === "number" });
    this._updateObjectStore(store, schema);
    modelBus().emit(IDB_LOG, { type: "store_created", store: storeName, fields: Object.keys(schema).length });
  },

  _updateObjectStore(store: IDBObjectStore, schema: ModelSchema) {
    for (const [field, def] of fieldsOf(schema)) {
      if ((def.index !== true && def.unique !== true) || store.indexNames.contains(field)) continue;
      store.createIndex(field, field, { unique: def.unique === true, multiEntry: def.$type === "array" });
      modelBus().emit(IDB_LOG, { type: "index_added", index: field, store: store.name });
    }
  },

  encode(this: IdbAdapter, model: string, row: Row) {
    const out = { ...row };
    for (const [field, def] of fieldsOf(this.models[model])) {
      const value = out[field];
      if (value === undefined || value === null) continue;
      if (def.$type === "boolean") out[field] = BOOLEAN_TO_STORAGE[String(value)] ?? value;
      else if ((def.$type === "date" || def.$type === "datetime") && value instanceof Date) out[field] = value.getTime();
    }
    return out;
  },

  decode(this: IdbAdapter, model: string, row: Row) {
    const out = { ...row };
    for (const [field, def] of fieldsOf(this.models[model])) {
      const value = out[field];
      if (value === undefined || value === null) continue;
      if (def.$type === "boolean") out[field] = STORAGE_TO_BOOLEAN[value as string | number] ?? value;
      else if ((def.$type === "date" || def.$type === "datetime") && typeof value === "number") out[field] = new Date(value);
    }
    return out;
  },

  async get(this: IdbAdapter, model: string, id: string | number) {
    const row: Row | undefined = await tx(this, model, "readonly", (store) => done(store.get(id)));
    return row ? this.decode(model, row) : null;
  },

  async query(this: IdbAdapter, model: string, options: QueryOptions = {}) {
    validateQueryOptions(options);
    const plan = planIndex(this.models[model], options.where);
    const rows = await tx(this, model, "readonly", async (store): Promise<Row[]> => {
      const found: Row[] = await done(plan ? store.index(plan.field).getAll(plan.range) : store.getAll());
      if (!plan?.multiEntry || found.length < 2) return found;
      const seen: Set<unknown> = new Set();
      return found.filter((row) => !seen.has(row.id) && seen.add(row.id));
    });
    const result = buildQueryResult(rows.map((row) => this.decode(model, row)), options);
    return { rows: result.items, total: result.total };
  },

  async insert(this: IdbAdapter, model: string, row: Row) {
    const encoded = this.encode(model, row);
    const key = await tx(this, model, "readwrite", (store) => done(store.add(encoded)));
    return this.decode(model, { ...encoded, id: encoded.id ?? (key as string | number) });
  },

  async insertMany(this: IdbAdapter, model: string, rows: Row[]) {
    const encoded = rows.map((row) => this.encode(model, row));
    const keys = await tx(this, model, "readwrite", (store) => Promise.all(encoded.map((row) => done(store.add(row)))));
    return encoded.map((row, index) => this.decode(model, { ...row, id: row.id ?? (keys[index] as string | number) }));
  },

  async update(this: IdbAdapter, model: string, row: Row) {
    const encoded = this.encode(model, row);
    await tx(this, model, "readwrite", (store) => done(store.put(encoded)));
    return this.decode(model, encoded);
  },

  async delete(this: IdbAdapter, model: string, id: string | number) {
    await tx(this, model, "readwrite", (store) => done(store.delete(id)));
    modelBus().emit(IDB_LOG, { type: "record_deleted", model, id });
  },

  async count(this: IdbAdapter, model: string, where?: WhereClause) {
    const plan = planIndex(this.models[model], where);
    const sole = where && Object.keys(where).length === 1;
    if (!where || Object.keys(where).length === 0)
      return tx(this, model, "readonly", (store) => done(store.count()));
    if (plan && sole && !plan.multiEntry)
      return tx(this, model, "readonly", (store) => done(store.index(plan.field).count(plan.range)));
    return (await this.query(model, { where })).total;
  },

  async truncate(this: IdbAdapter, model: string) {
    await tx(this, model, "readwrite", (store) => done(store.clear()));
    modelBus().emit(IDB_LOG, { type: "store_truncated", model });
  },

  async close(this: IdbAdapter) {
    if (!this.db) return;
    this.db.close();
    this.db = null;
    this.connectionPromise = null;
    modelBus().emit(IDB_LOG, { type: "connection_closed", name: this.name });
  },
};

export default IndexedDBAdapter;
export { IndexedDBAdapter };
