/**
 * @bootstrapp/light/model/store: every model's reads and writes over the
 * adapter that holds it, in the page or in a worker. The write pipeline runs
 * once here for every adapter: hooks, id, relation stripping, defaults,
 * validation, file uploads, then the adapter's own insert/update/delete, then
 * the `model:changed` event live queries follow. Adapters store rows; the store knows the
 * schema. A model's adapter is the routed one wrapped by the decorators its
 * schema directives call for (`registerAdapterDecorator`); a `$shadow`
 * directive names a second, device-local adapter a decorator may use.
 */

import { MODEL_CHANGED } from "./events.ts";
import { newId } from "./config.ts";
import { decoratorsFor } from "./factory.ts";
import { ValidationError, validateRow } from "./validate.ts";
import { uploadFiles } from "./file-storage.ts";
import { loadRelationships, loadRelationshipsForMany } from "./relationship-loader.ts";
import { relationValueToId } from "./relationships.ts";
import { applyFields, validateQueryOptions } from "./query-builder.ts";
import { eachField, entryOf, schemaField } from "./fields.ts";

export { createModelHandlers, storeRequest } from "./handlers.ts";

import type { FacetResult, HookContext, ModelHooks, ModelSchema, QueryOptions, QueryPage, Row, StorageAdapter, Store, StoreConfig, WriteOptions } from "./types.ts";

const isId = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

const copy = (record: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(record));

const callHook = (name: keyof ModelHooks, fn: unknown, row: Row | null, ctx: HookContext): unknown => {
  if (typeof fn !== "function") throw new TypeError(`$hooks.${name} is not a function`);
  return fn(row, ctx);
};

const forStorage = (schema: ModelSchema | undefined, row: Row): Row => {
  const out = copy(row);
  eachField(schema, (field, def) => {
    if (!def.relationship) return;
    if (!def.belongs) {
      delete out[field];
      return;
    }
    if (out[field] === undefined) return;
    const value = out[field];
    out[field] = def.relationship === "belongs_many" && Array.isArray(value)
      ? value.map(relationValueToId)
      : relationValueToId(value);
  });
  return out;
};

const withDefaults = (schema: ModelSchema | undefined, row: Row): Row => {
  eachField(schema, (field, def) => {
    if (row[field] !== undefined || def.defaultValue === undefined) return;
    if (def.relationship && !def.belongs) return;
    const value = def.defaultValue;
    row[field] = typeof value === "function" ? (value as () => unknown)() : value && typeof value === "object" ? structuredClone(value) : value;
  });
  return row;
};

const withoutImmutable = (schema: ModelSchema | undefined, patch: Row): Row => {
  const out = copy(patch);
  eachField(schema, (field, def) => {
    if (def.immutable && field !== "id") delete out[field];
  });
  return out;
};

const at = (error: unknown, index: number): Error => {
  const failure = error instanceof Error ? error : new Error(String(error));
  Reflect.set(failure, "index", index);
  return failure;
};

const without = (record: Record<string, unknown>, omitted: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => key !== omitted));

const queryOf = (opts: QueryOptions | undefined): QueryOptions => (opts === undefined ? {} : opts);

const writeOf = (options: WriteOptions | undefined): WriteOptions => (options === undefined ? {} : options);

const merged = (...rows: Row[]): Row => Object.fromEntries(rows.flatMap((row) => Object.entries(row)));

/** The store over `models` and the adapters in `databases`, routing each model to its adapter. */
export function createStore({ models, databases = {}, defaultAdapter = "indexeddb", emit = null }: StoreConfig): Store {
  const routes: Map<string, string> = new Map();
  const decorated: Map<string, StorageAdapter> = new Map();

  const route = (): void => {
    decorated.clear();
    for (const [name, schema] of Object.entries(models)) {
      if (name.startsWith("$")) continue;
      const wanted = schema.$extension ? `ext:${schema.$extension}` : (schema.$adapter || defaultAdapter);
      const target = entryOf(databases, wanted);
      if (!target) console.warn(`[store] no "${wanted}" database for model "${name}"; using "${defaultAdapter}"`);
      routes.set(name, target ? wanted : defaultAdapter);
    }
  };

  const baseAdapterFor = (model: string): StorageAdapter => {
    const name = routes.get(model);
    const adapter = name ? entryOf(databases, name) : undefined;
    if (!adapter)
      throw new Error(`Model "${model}" is not mapped to any database. Registered models: ${[...routes.keys()].join(", ")}`);
    return adapter;
  };

  const shadowFor = (model: string): StorageAdapter | null => {
    const name = schemaOf(model)?.$shadow;
    if (!name) return null;
    return entryOf(databases, name) ?? null;
  };

  const adapterFor = (model: string): StorageAdapter => {
    const known = decorated.get(model);
    if (known) return known;
    const schema = schemaOf(model);
    let adapter = baseAdapterFor(model);
    for (const decorate of decoratorsFor(schema))
      adapter = decorate(adapter, { model, schema, store, shadow: shadowFor(model), emit: emit ?? (() => undefined) });
    decorated.set(model, adapter);
    return adapter;
  };

  const schemaOf = (model: string): ModelSchema | undefined => entryOf(models, model);

  const hookOf = (model: string, name: keyof ModelHooks): unknown => schemaOf(model)?.$hooks?.[name];

  const changed = (model: string, action: "add" | "edit" | "remove", row: Row): void => {
    if (emit) emit(MODEL_CHANGED, { model, action, row });
  };

  const context = (model: string, operation: HookContext["operation"], extra: Partial<HookContext> = {}): HookContext => ({ model, store, operation, ...extra });

  const runBefore = async (model: string, name: "beforeAdd" | "beforeEdit", data: Row, ctx: HookContext): Promise<Row> => {
    const fn = hookOf(model, name);
    if (!fn) return data;
    const out = await callHook(name, fn, data, ctx);
    return out == null ? data : (out as Row);
  };

  const runAfter = async (model: string, name: "afterAdd" | "afterEdit" | "afterRemove", row: Row | null, ctx: HookContext): Promise<void> => {
    const fn = hookOf(model, name);
    if (fn) await callHook(name, fn, row, ctx);
  };

  const prepareAdd = async (model: string, data: Row, options: WriteOptions): Promise<Row> => {
    const schema = schemaOf(model);
    let row = await runBefore(model, "beforeAdd", copy(data), context(model, "add", { importing: Boolean(options.importing) }));
    if (row.id == null) {
      const adapter = adapterFor(model);
      const nextId = adapter.nextId;
      if (typeof nextId === "function") row.id = nextId.call(adapter, model, row);
      else {
        const idField = schema ? schemaField(schema, "id") : undefined;
        if (idField?.$type !== "number") row.id = newId();
      }
    }
    row = withDefaults(schema, forStorage(schema, row));
    const { valid, errors } = validateRow(models, model, row, { operation: "add" });
    if (!valid) throw new ValidationError(model, errors);
    return uploadFiles(schema, model, row);
  };

  const store: Store = {
    models,
    databases,
    defaultAdapter,
    adapterFor,
    baseAdapterFor,
    shadowFor,

    addDatabase(name, adapter): void {
      databases[name] = adapter;
      route();
    },

    addModels(more): void {
      Object.assign(models, more);
      route();
    },

    supportsOperator(model, operator): boolean {
      const adapter = adapterFor(model);
      const supports = adapter.supportsOperator;
      return typeof supports === "function" ? supports.call(adapter, operator) : false;
    },

    async get(model, idOrWhere, options): Promise<Row | null> {
      const opts: QueryOptions = options === undefined ? {} : options;
      const adapter = adapterFor(model);
      let row: Row | null = null;
      const scope: Pick<QueryOptions, "locale"> = opts.locale ? { locale: opts.locale } : {};
      if (isId(idOrWhere)) row = await adapter.get(model, idOrWhere, scope);
      else if (idOrWhere && typeof idOrWhere === "object") {
        const first: QueryOptions = { where: idOrWhere, order: opts.order, limit: 1, total: false };
        if (opts.locale) first.locale = opts.locale;
        const { rows } = await adapter.query(model, first);
        const found = rows[0] ?? null;
        row = found;
        const heavy = schemaOf(model)?.$heavy ?? [];
        if (found && heavy.some((field) => !(field in found)))
          row = (await adapter.get(model, found.id as string | number, scope)) ?? found;
      }
      if (!row) return null;
      const includes = opts.includes ?? [];
      if (includes.length) row = await loadRelationships(store, models, model, row, includes);
      return opts.fields?.length ? applyFields([row], [...opts.fields, ...includes])[0] : row;
    },

    async query(model, given): Promise<QueryPage> {
      const opts = queryOf(given);
      validateQueryOptions(opts);
      const { includes } = opts;
      const selection: QueryOptions = without(opts, "includes");
      const { rows, total } = await adapterFor(model).query(model, selection);
      return { rows: includes?.length ? await loadRelationshipsForMany(store, models, model, rows, includes) : rows, total };
    },

    async getAll(model, given): Promise<Row[]> {
      const query: QueryOptions = copy(queryOf(given));
      query.total = false;
      return (await store.query(model, query)).rows;
    },

    async count(model, given): Promise<number> {
      return adapterFor(model).count(model, queryOf(given).where);
    },

    async exists(model, where): Promise<boolean> {
      const adapter = adapterFor(model);
      const exists = adapter.exists;
      if (typeof exists === "function") return exists.call(adapter, model, where);
      return (await adapter.count(model, where)) > 0;
    },

    async facets(model, fields, given): Promise<FacetResult> {
      const adapter = adapterFor(model);
      const facets = adapter.facets;
      if (typeof facets === "function") return facets.call(adapter, model, fields, queryOf(given));
      return {};
    },

    async add(model, data, given): Promise<Row> {
      const options = writeOf(given);
      const row = await prepareAdd(model, data, options);
      const stored = await adapterFor(model).insert(model, row, options);
      changed(model, "add", stored);
      await runAfter(model, "afterAdd", stored, context(model, "add", { importing: Boolean(options.importing) }));
      return stored;
    },

    async addMany(model, rows, given): Promise<Row[]> {
      const options = writeOf(given);
      const adapter = adapterFor(model);
      const prepared: Row[] = [];
      for (const [index, data] of rows.entries())
        try {
          prepared.push(await prepareAdd(model, data, options));
        } catch (error) {
          throw at(error, index);
        }
      let stored: Row[] = [];
      const insertMany = adapter.insertMany;
      if (typeof insertMany === "function") stored = await insertMany.call(adapter, model, prepared, options);
      else
        for (const [index, row] of prepared.entries())
          try {
            stored.push(await adapter.insert(model, row, options));
          } catch (error) {
            throw at(error, index);
          }
      const ctx = context(model, "add", { importing: Boolean(options.importing) });
      for (const row of stored) changed(model, "add", row);
      for (const row of stored) await runAfter(model, "afterAdd", row, ctx);
      return stored;
    },

    async edit(model, id, patch, given): Promise<Row> {
      const options = writeOf(given);
      const schema = schemaOf(model);
      const adapter = adapterFor(model);
      const ctx = context(model, "edit", { id });
      const changes = await runBefore(model, "beforeEdit", merged(forStorage(schema, withoutImmutable(schema, patch)), { id }), ctx);
      const current = await adapter.get(model, id);
      if (!current) throw new Error(`Record ${id} not found in model "${model}"`);
      let row = forStorage(schema, merged(current, changes, { id }));
      const { valid, errors } = validateRow(models, model, row, { operation: "edit" });
      if (!valid) throw new ValidationError(model, errors);
      row = await uploadFiles(schema, model, row);
      const stored = await adapter.update(model, row, { ...options, patch: without(changes, "id") });
      changed(model, "edit", stored);
      await runAfter(model, "afterEdit", stored, ctx);
      return stored;
    },

    async remove(model, id, given): Promise<boolean> {
      const options = writeOf(given);
      const adapter = adapterFor(model);
      const ctx = context(model, "remove", { id });
      const before = hookOf(model, "beforeRemove");
      const current = before || hookOf(model, "afterRemove") ? await adapter.get(model, id) : null;
      if (before && (await callHook("beforeRemove", before, current, ctx)) === false) return false;
      await adapter.delete(model, id, options);
      changed(model, "remove", current ?? { id });
      await runAfter(model, "afterRemove", current, ctx);
      return true;
    },

    async removeAll(model, where): Promise<number> {
      const rows = await store.getAll(model, { where, fields: ["id"] });
      let removed = 0;
      for (const row of rows) if (await store.remove(model, row.id as string | number)) removed += 1;
      return removed;
    },

    async truncate(model): Promise<void> {
      const adapter = adapterFor(model);
      const truncate = adapter.truncate;
      if (typeof truncate === "function") await truncate.call(adapter, model);
    },

    async runAfterAdd(model, row): Promise<void> {
      await runAfter(model, "afterAdd", row, context(model, "add"));
    },

    async exportData(): Promise<Record<string, Row[]>> {
      const dump: Record<string, Row[]> = {};
      for (const model of routes.keys()) dump[model] = (await baseAdapterFor(model).query(model, {})).rows;
      return dump;
    },

    async importData(dump): Promise<void> {
      for (const [model, rows] of Object.entries(dump)) {
        if (!routes.has(model)) {
          console.warn(`[store] import skips "${model}": no such model`);
          continue;
        }
        if (Array.isArray(rows) && rows.length) await store.addMany(model, rows, { importing: true });
      }
    },

    async close(): Promise<void> {
      for (const adapter of Object.values(databases)) await adapter.close();
    },
  };

  route();
  return store;
}
