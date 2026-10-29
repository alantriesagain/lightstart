/**
 * @lightstart/light/model/sql: a storage adapter over one synchronous SQLite
 * database. The model schema is the table definition; the SQL builder turns
 * reads and writes into parameterized statements, and JSON and boolean
 * fields cross as SQLite text and integers. The database is injected, so the
 * same adapter runs over `@lightstart/sqlite/node`, the native driver, D1 or
 * Durable Objects. Importing it registers nothing: `registerStorageAdapter("sql",
 * SqlAdapter)`, then `createAdapter("sql", { name, db, models })`; `openSql`
 * does both for a process that holds its own models and store.
 */

import { configureModel, modelBus } from "./config.ts";
import { createAdapter, hasAdapter, registerStorageAdapter } from "./factory.ts";
import { buildQueryResult, validateQueryOptions } from "./query-builder.ts";
import { createStore, storeRequest } from "./store.ts";
import {
  applySchema, buildCountSQL, buildDeleteSQL, buildInsertSQL, buildSelectSQL, buildUpdateSQL,
  getBooleanFields, getJsonFields, numericId, quoteIdent,
} from "./sql-builder.ts";

import type { SqlDatabase } from "@lightstart/sqlite";
import type { ModelApi, ModelSchema, QueryOptions, QueryPage, Row, StorageAdapter, Store, WhereClause, WriteOptions } from "./types.ts";

const OPERATORS: string[] = [">", ">=", "<", "<=", "!=", "<>", "=", "in", "not in", "has", "has all", "like", "ilike", "is null", "is not null"];

/** The adapter as `createAdapter("sql", { name, db, models })` makes it. */
export type SqlStorage = StorageAdapter & {
  db: SqlDatabase;
  models: Record<string, ModelSchema>;
};

const copy = (row: Row): Row => Object.fromEntries(Object.entries(row));

const decode = (schema: ModelSchema | undefined, row: Row): Row => {
  const json = getJsonFields(schema);
  const booleans = getBooleanFields(schema);
  const decoded: Row = copy(row);
  for (const field of json) {
    const value = decoded[field];
    if (typeof value === "string" && value !== "") decoded[field] = JSON.parse(value);
  }
  for (const field of booleans) {
    const value = decoded[field];
    if (value !== null && value !== undefined) decoded[field] = Boolean(Number(value));
  }
  return decoded;
};

const selectOne = (db: SqlDatabase, model: string, id: string | number, schema: ModelSchema | undefined): Row | null => {
  const query = buildSelectSQL(model, { where: { id } });
  const row = db.prepare(query.sql).get(query.params);
  return row === null ? null : decode(schema, row);
};

const insertRow = (adapter: SqlStorage, model: string, row: Row): Row => {
  const schema = adapter.models[model];
  const query = buildInsertSQL(model, row, getJsonFields(schema));
  const result = adapter.db.prepare(query.sql).run(query.params);
  const assigned = typeof result.lastId === "bigint" ? Number(result.lastId) : result.lastId;
  const id = row.id ?? (numericId(schema) ? assigned : null);
  const stored = id === null ? null : selectOne(adapter.db, model, id, schema);
  return stored === null ? copy(row) : stored;
};

const updateRow = (adapter: SqlStorage, model: string, row: Row, options: WriteOptions | undefined): Row => {
  const schema = adapter.models[model];
  const data = options?.patch ?? row;
  const query = buildUpdateSQL(model, row.id as string | number, data, getJsonFields(schema));
  adapter.db.prepare(query.sql).run(query.params);
  const stored = selectOne(adapter.db, model, row.id as string | number, schema);
  return stored === null ? copy(row) : stored;
};

const whereCount = (db: SqlDatabase, model: string, where: WhereClause | undefined): number => {
  const query = buildCountSQL(model, { where });
  return Number(db.prepare(query.sql).get(query.params)?.["count"] ?? 0);
};

/** The SQL adapter object; its state is the injected database and the models it holds. */
const SqlAdapter: StorageAdapter = {
  async init(this: SqlStorage): Promise<void> {
    applySchema(this.db, this.models ?? {});
  },

  async get(this: SqlStorage, model: string, id: string | number): Promise<Row | null> {
    return selectOne(this.db, model, id, this.models[model]);
  },

  async query(this: SqlStorage, model: string, given: QueryOptions | undefined): Promise<QueryPage> {
    const options: QueryOptions = given === undefined ? {} : given;
    validateQueryOptions(options);
    const schema = this.models[model];
    if (options.groupBy !== undefined) {
      const all = buildSelectSQL(model, { where: options.where, order: options.order });
      const rows = this.db.prepare(all.sql).all(all.params).map((row) => decode(schema, row));
      const result = buildQueryResult(rows, options);
      return { rows: result.items, total: result.total };
    }
    const selection: QueryOptions = options.fields === undefined || options.fields.includes("id") ? options : { ...options, fields: [...options.fields, "id"] };
    const query = buildSelectSQL(model, selection);
    const rows = this.db.prepare(query.sql).all(query.params).map((row) => decode(schema, row));
    const total = options.total === false ? rows.length : whereCount(this.db, model, options.where);
    return { rows, total };
  },

  async insertMany(this: SqlStorage, model: string, rows: Row[]): Promise<Row[]> {
    const stored: Row[] = [];
    this.db.transaction(() => {
      for (const row of rows) stored.push(insertRow(this, model, row));
    });
    return stored;
  },

  async insert(this: SqlStorage, model: string, row: Row): Promise<Row> {
    return insertRow(this, model, row);
  },

  async update(this: SqlStorage, model: string, row: Row, options?: WriteOptions): Promise<Row> {
    return updateRow(this, model, row, options);
  },

  async delete(this: SqlStorage, model: string, id: string | number): Promise<boolean> {
    const query = buildDeleteSQL(model, id);
    return this.db.prepare(query.sql).run(query.params).changes > 0;
  },

  async count(this: SqlStorage, model: string, where: WhereClause | undefined): Promise<number> {
    return whereCount(this.db, model, where);
  },

  async exists(this: SqlStorage, model: string, where: WhereClause | undefined): Promise<boolean> {
    return whereCount(this.db, model, where) > 0;
  },

  async truncate(this: SqlStorage, model: string): Promise<void> {
    this.db.exec(`DELETE FROM ${quoteIdent(model)}`);
  },

  async close(this: SqlStorage): Promise<void> {
    this.db.close();
  },

  supportsOperator(operator: string): boolean {
    return OPERATORS.includes(operator);
  },
};

export default SqlAdapter;

/** What `openSql` takes: the database's name, the driver, and the models it holds. */
export interface SqlOpen {
  name: string;
  db: SqlDatabase;
  models: ModelApi<Row, ModelSchema>[];
}

/**
 * The store of a process that holds its own models, over one SQLite database:
 * the adapter registered once, opened on `db`, a store over the models'
 * schemas with the model bus as its emitter, and the store's request as what
 * every model call goes through from here on. Answers the store.
 */
export const openSql = async ({ name, db, models }: SqlOpen): Promise<Store> => {
  if (!hasAdapter("sql")) registerStorageAdapter("sql", SqlAdapter);
  const schemas = Object.fromEntries(models.map((model): [string, ModelSchema] => [model.name, model.schema]));
  const adapter = createAdapter("sql", { name, db, models: schemas });
  await adapter.init();
  const store = createStore({
    models: schemas,
    databases: { sql: adapter },
    defaultAdapter: "sql",
    emit: (event, data) => modelBus().emit(event, data),
  });
  configureModel({ request: storeRequest(store) });
  return store;
};
