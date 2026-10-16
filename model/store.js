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

import { MODEL_CHANGED } from "./events.js";
import { newId } from "./config.js";
import { decoratorsFor } from "./factory.js";
import { ValidationError, validateRow } from "./validate.js";
import { uploadFiles } from "./file-storage.js";
import { loadRelationships, loadRelationshipsForMany } from "./relationship-loader.js";
import { relationValueToId } from "./relationships.js";
import { applyFields, validateQueryOptions } from "./query-builder.js";

export { createModelHandlers, storeRequest } from "./handlers.js";

/** @import { HookContext, ModelHooks, ModelSchema, QueryOptions, Row, StorageAdapter, Store, StoreConfig, WhereClause, WriteOptions } from "./types.ts" */

/** @param {unknown} value @returns {value is string | number} */
const isId = (value) => typeof value === "string" || typeof value === "number";

/**
 * @param {ModelSchema | undefined} schema
 * @param {(field: string, def: Record<string, any>) => void} visit
 */
const eachField = (schema, visit) => {
  for (const [field, def] of Object.entries(schema ?? {}))
    if (!field.startsWith("$") && def && typeof def === "object") visit(field, def);
};

/**
 * @param {ModelSchema | undefined} schema
 * @param {Row} row
 * @returns {Row}
 */
const forStorage = (schema, row) => {
  const out = { ...row };
  eachField(schema, (field, def) => {
    if (!def.relationship) return;
    if (!def.belongs) {
      delete out[field];
      return;
    }
    if (out[field] === undefined) return;
    out[field] = def.relationship === "belongs_many" && Array.isArray(out[field])
      ? /** @type {unknown[]} */ (out[field]).map(relationValueToId)
      : relationValueToId(out[field]);
  });
  return out;
};

/**
 * @param {ModelSchema | undefined} schema
 * @param {Row} row
 * @returns {Row}
 */
const withDefaults = (schema, row) => {
  eachField(schema, (field, def) => {
    if (row[field] !== undefined || def.defaultValue === undefined) return;
    if (def.relationship && !def.belongs) return;
    const value = def.defaultValue;
    row[field] = typeof value === "function" ? value() : value && typeof value === "object" ? structuredClone(value) : value;
  });
  return row;
};

/**
 * @param {ModelSchema | undefined} schema
 * @param {Row} patch
 * @returns {Row}
 */
const withoutImmutable = (schema, patch) => {
  const out = { ...patch };
  eachField(schema, (field, def) => {
    if (def.immutable && field !== "id") delete out[field];
  });
  return out;
};

/**
 * @param {unknown} error
 * @param {number} index
 */
const at = (error, index) => Object.assign(error instanceof Error ? error : new Error(String(error)), { index });

/** @param {Row} row @returns {Row} */
const withoutId = (row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id"));

/**
 * @param {StoreConfig} config
 * @returns {Store}
 */
export function createStore({ models, databases = {}, defaultAdapter = "indexeddb", emit = null }) {
  /** @type {Map<string, string>} */
  const routes = new Map();
  /** @type {Map<string, StorageAdapter>} */
  const decorated = new Map();

  const route = () => {
    decorated.clear();
    for (const [name, schema] of Object.entries(models)) {
      if (name.startsWith("$")) continue;
      const wanted = schema.$extension ? `ext:${schema.$extension}` : (schema.$adapter || defaultAdapter);
      if (!databases[wanted]) console.warn(`[store] no "${wanted}" database for model "${name}"; using "${defaultAdapter}"`);
      routes.set(name, databases[wanted] ? wanted : defaultAdapter);
    }
  };

  /** @param {string} model */
  const baseAdapterFor = (model) => {
    const name = routes.get(model);
    const adapter = name ? databases[name] : undefined;
    if (!adapter)
      throw new Error(`Model "${model}" is not mapped to any database. Registered models: ${[...routes.keys()].join(", ")}`);
    return adapter;
  };

  /** @param {string} model */
  const shadowFor = (model) => {
    const name = models[model]?.$shadow;
    return (name && databases[name]) || null;
  };

  /** @param {string} model */
  const adapterFor = (model) => {
    const known = decorated.get(model);
    if (known) return known;
    const schema = models[model];
    let adapter = baseAdapterFor(model);
    for (const decorate of decoratorsFor(schema))
      adapter = decorate(adapter, { model, schema, store, shadow: shadowFor(model), emit: emit ?? (() => undefined) });
    decorated.set(model, adapter);
    return adapter;
  };

  /** @param {string} model */
  const schemaOf = (model) => models[model];

  /**
   * @param {string} model
   * @param {keyof ModelHooks} name
   */
  const hookOf = (model, name) => schemaOf(model)?.$hooks?.[name];

  /**
   * @param {string} model
   * @param {"add" | "edit" | "remove"} action
   * @param {Row} row
   */
  const changed = (model, action, row) => {
    if (emit) emit(MODEL_CHANGED, { model, action, row });
  };

  /**
   * @param {string} model
   * @param {HookContext["operation"]} operation
   * @param {Partial<HookContext>} [extra]
   * @returns {HookContext}
   */
  const context = (model, operation, extra = {}) => ({ model, store, operation, ...extra });

  /**
   * @param {string} model
   * @param {"beforeAdd" | "beforeEdit"} name
   * @param {Row} data
   * @param {HookContext} ctx
   * @returns {Promise<Row>}
   */
  const runBefore = async (model, name, data, ctx) => {
    const fn = hookOf(model, name);
    if (!fn) return data;
    const out = await fn(data, ctx);
    return out == null ? data : /** @type {Row} */ (out);
  };

  /**
   * @param {string} model
   * @param {"afterAdd" | "afterEdit" | "afterRemove"} name
   * @param {Row | null} row
   * @param {HookContext} ctx
   */
  const runAfter = async (model, name, row, ctx) => {
    const fn = hookOf(model, name);
    if (fn) await fn(/** @type {Row} */ (row), ctx);
  };

  /**
   * @param {string} model
   * @param {Row} data
   * @param {WriteOptions} options
   */
  const prepareAdd = async (model, data, options) => {
    const schema = schemaOf(model);
    let row = await runBefore(model, "beforeAdd", { ...data }, context(model, "add", { importing: Boolean(options.importing) }));
    if (row.id == null) {
      const adapter = adapterFor(model);
      if (adapter.nextId) row.id = adapter.nextId(model, row);
      else if (/** @type {{ $type?: string } | undefined} */ (schema?.id)?.$type !== "number") row.id = newId();
    }
    row = withDefaults(schema, forStorage(schema, row));
    const { valid, errors } = validateRow(models, model, row, { operation: "add" });
    if (!valid) throw new ValidationError(model, errors);
    return uploadFiles(schema, model, row);
  };

  /** @type {Store} */
  const store = {
    models,
    databases,
    defaultAdapter,
    adapterFor,
    baseAdapterFor,
    shadowFor,

    addDatabase(name, adapter) {
      databases[name] = adapter;
      route();
    },

    addModels(more) {
      Object.assign(models, more);
      route();
    },

    supportsOperator(model, operator) {
      const adapter = adapterFor(model);
      return adapter.supportsOperator ? adapter.supportsOperator(operator) : false;
    },

    async get(model, idOrWhere, opts = {}) {
      const adapter = adapterFor(model);
      /** @type {Row | null} */
      let row = null;
      const scope = opts.locale ? { locale: opts.locale } : {};
      if (isId(idOrWhere)) row = await adapter.get(model, idOrWhere, scope);
      else if (idOrWhere && typeof idOrWhere === "object") {
        const { rows } = await adapter.query(model, { where: /** @type {WhereClause} */ (idOrWhere), order: opts.order, limit: 1, total: false, ...scope });
        row = rows[0] ?? null;
        const heavy = schemaOf(model)?.$heavy ?? [];
        if (row && heavy.some((field) => !(field in /** @type {Row} */ (row))))
          row = (await adapter.get(model, /** @type {string | number} */ (row.id), scope)) ?? row;
      }
      if (!row) return null;
      const includes = opts.includes ?? [];
      if (includes.length) row = await loadRelationships(store, models, model, row, includes);
      return opts.fields?.length ? applyFields([row], [...opts.fields, ...includes])[0] : row;
    },

    async query(model, opts = {}) {
      validateQueryOptions(opts);
      const { includes, ...selection } = opts;
      const { rows, total } = await adapterFor(model).query(model, selection);
      return { rows: includes?.length ? await loadRelationshipsForMany(store, models, model, rows, includes) : rows, total };
    },

    async getAll(model, opts = {}) {
      return (await store.query(model, { ...opts, total: false })).rows;
    },

    async count(model, opts = {}) {
      return adapterFor(model).count(model, opts.where);
    },

    async exists(model, where) {
      const adapter = adapterFor(model);
      return adapter.exists ? adapter.exists(model, where) : (await adapter.count(model, where)) > 0;
    },

    async facets(model, fields, opts = {}) {
      const adapter = adapterFor(model);
      return adapter.facets ? adapter.facets(model, fields, opts) : {};
    },

    async add(model, data, options = {}) {
      const row = await prepareAdd(model, data, options);
      const stored = await adapterFor(model).insert(model, row, options);
      changed(model, "add", stored);
      await runAfter(model, "afterAdd", stored, context(model, "add", { importing: Boolean(options.importing) }));
      return stored;
    },

    async addMany(model, rows, options = {}) {
      const adapter = adapterFor(model);
      /** @type {Row[]} */
      const prepared = [];
      for (const [index, data] of rows.entries())
        try {
          prepared.push(await prepareAdd(model, data, options));
        } catch (error) {
          throw at(error, index);
        }
      /** @type {Row[]} */
      let stored = [];
      if (adapter.insertMany) stored = await adapter.insertMany(model, prepared, options);
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

    async edit(model, id, patch, options = {}) {
      const schema = schemaOf(model);
      const adapter = adapterFor(model);
      const ctx = context(model, "edit", { id });
      const changes = await runBefore(model, "beforeEdit", { ...forStorage(schema, withoutImmutable(schema, patch)), id }, ctx);
      const current = await adapter.get(model, id);
      if (!current) throw new Error(`Record ${id} not found in model "${model}"`);
      let merged = forStorage(schema, { ...current, ...changes, id });
      const { valid, errors } = validateRow(models, model, merged, { operation: "edit" });
      if (!valid) throw new ValidationError(model, errors);
      merged = await uploadFiles(schema, model, merged);
      const stored = await adapter.update(model, merged, { ...options, patch: withoutId(changes) });
      changed(model, "edit", stored);
      await runAfter(model, "afterEdit", stored, ctx);
      return stored;
    },

    async remove(model, id, options = {}) {
      const adapter = adapterFor(model);
      const ctx = context(model, "remove", { id });
      const before = hookOf(model, "beforeRemove");
      const current = before || hookOf(model, "afterRemove") ? await adapter.get(model, id) : null;
      if (before && (await before(/** @type {Row} */ (current), ctx)) === false) return false;
      await adapter.delete(model, id, options);
      changed(model, "remove", current ?? { id });
      await runAfter(model, "afterRemove", current, ctx);
      return true;
    },

    async removeAll(model, where) {
      const rows = await store.getAll(model, { where, fields: ["id"] });
      let removed = 0;
      for (const row of rows) if (await store.remove(model, /** @type {string | number} */ (row.id))) removed += 1;
      return removed;
    },

    async truncate(model) {
      const adapter = adapterFor(model);
      if (adapter.truncate) await adapter.truncate(model);
    },

    async runAfterAdd(model, row) {
      await runAfter(model, "afterAdd", row, context(model, "add"));
    },

    async exportData() {
      /** @type {Record<string, Row[]>} */
      const dump = {};
      for (const model of routes.keys()) dump[model] = (await baseAdapterFor(model).query(model, {})).rows;
      return dump;
    },

    async importData(dump) {
      for (const [model, rows] of Object.entries(dump)) {
        if (!routes.has(model)) {
          console.warn(`[store] import skips "${model}": no such model`);
          continue;
        }
        if (Array.isArray(rows) && rows.length) await store.addMany(model, rows, { importing: true });
      }
    },

    async close() {
      for (const adapter of Object.values(databases)) await adapter.close();
    },
  };

  route();
  return store;
}
