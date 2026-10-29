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
  applySchema, buildCountSQL, buildDeleteSQL, buildInsertSQL, buildSelectSQL, buildUpdateSQL, buildWhereClause,
  getArrayFields, getBooleanFields, getJsonFields, quoteIdent,
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

/** What a schema stores as JSON text, as SQLite's 1 or 0, and as a JSON array. */
class FieldSets {
  readonly json: Set<string>;
  readonly booleans: Set<string>;
  readonly arrays: Set<string>;

  constructor(schema: ModelSchema | undefined) {
    this.json = getJsonFields(schema);
    this.booleans = getBooleanFields(schema);
    this.arrays = getArrayFields(schema);
  }
}

const NO_FIELDS = new FieldSets(undefined);
const fieldSets = new Map<ModelSchema, FieldSets>();

/** The field sets of `schema`, worked out once per schema object. */
const setsOf = (schema: ModelSchema | undefined): FieldSets => {
  if (schema === undefined) return NO_FIELDS;
  const known = fieldSets.get(schema);
  if (known !== undefined) return known;
  const found = new FieldSets(schema);
  fieldSets.set(schema, found);
  return found;
};

/** The array fields of `schema`, for `buildWhereClause` and the select and count builders. */
export const arrayFieldsOf = (schema: ModelSchema | undefined): Set<string> => setsOf(schema).arrays;

/** Decode one stored row: JSON text back to its value, booleans back to true or false. */
export const decodeRow = (schema: ModelSchema | undefined, row: Row): Row => {
  const { json, booleans } = setsOf(schema);
  if (json.size === 0 && booleans.size === 0) return row;
  const entries = Object.entries(row).map(([field, value]): [string, unknown] => {
    if (json.has(field) && typeof value === "string" && value !== "") return [field, JSON.parse(value)];
    if (booleans.has(field) && value !== null && value !== undefined) return [field, Boolean(Number(value))];
    return [field, value];
  });
  return Object.fromEntries(entries);
};

const selectOne = (db: SqlDatabase, model: string, id: string | number, schema: ModelSchema | undefined): Row | null => {
  const query = buildSelectSQL(model, { where: { id } });
  const row = db.prepare(query.sql).get(query.params);
  return row === null ? null : decodeRow(schema, row);
};

const insertRow = (adapter: SqlStorage, model: string, row: Row): Row => {
  const schema = adapter.models[model];
  const query = buildInsertSQL(model, row, getJsonFields(schema));
  const rows = JSON.parse(adapter.db.prepare(`${query.sql} RETURNING *`).json(query.params)) as Row[];
  return rows.length === 0 ? copy(row) : decodeRow(schema, rows[0]!);
};

const updateRow = (adapter: SqlStorage, model: string, row: Row, options: WriteOptions | undefined): Row => {
  const schema = adapter.models[model];
  const data = options?.patch ?? row;
  const query = buildUpdateSQL(model, row.id as string | number, data, getJsonFields(schema));
  const rows = JSON.parse(adapter.db.prepare(`${query.sql} RETURNING *`).json(query.params)) as Row[];
  return rows.length === 0 ? copy(row) : decodeRow(schema, rows[0]!);
};

const whereCount = (db: SqlDatabase, model: string, schema: ModelSchema | undefined, where: WhereClause | undefined): number => {
  const query = buildCountSQL(model, { where, arrays: arrayFieldsOf(schema) });
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
      const all = buildSelectSQL(model, { where: options.where, order: options.order, arrays: arrayFieldsOf(schema) });
      const rows = this.db.prepare(all.sql).all(all.params).map((row) => decodeRow(schema, row));
      const result = buildQueryResult(rows, options);
      return { rows: result.items, total: result.total };
    }
    let fields = options.fields;
    if (fields !== undefined && !fields.includes("id")) {
      const named: string[] = [];
      for (const field of fields) named.push(String(field));
      named.push("id");
      fields = named;
    }
    const query = buildSelectSQL(model, { where: options.where, order: options.order, limit: options.limit, offset: options.offset, fields, arrays: arrayFieldsOf(schema) });
    const rows = this.db.prepare(query.sql).all(query.params).map((row) => decodeRow(schema, row));
    const total = options.total === false ? rows.length : whereCount(this.db, model, schema, options.where);
    return { rows, total };
  },

  async insertMany(this: SqlStorage, model: string, rows: Row[]): Promise<Row[]> {
    const stored: Row[] = [];
    this.db.transaction(() => {
      for (const row of rows) stored.push(insertRow(this, model, row));
      return 0;
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
    return whereCount(this.db, model, this.models[model], where);
  },

  async exists(this: SqlStorage, model: string, where: WhereClause | undefined): Promise<boolean> {
    const clause = buildWhereClause(where, arrayFieldsOf(this.models[model]));
    const sql = `SELECT EXISTS(SELECT 1 FROM ${quoteIdent(model)}${clause.sql === "" ? "" : ` WHERE ${clause.sql}`}) AS found`;
    return Number(this.db.prepare(sql).get(clause.params)?.["found"] ?? 0) === 1;
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
