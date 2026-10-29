/**
 * @lightstart/light/model/sql-builder: model schemas as SQLite SQL. Every
 * identifier that reaches a statement is a bare name, checked here; every
 * value is a bound parameter. The same generator serves a local SQLite file
 * and Cloudflare D1, so one schema answers one table on either.
 */

import { parseOrder } from "./query-builder.ts";

import type { ModelSchema, OrderSpec, QueryOptions, WhereClause } from "./types.ts";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

const SQLITE_RESERVED = new Set([
  "abort", "action", "add", "after", "all", "alter", "always", "analyze",
  "and", "as", "asc", "attach", "autoincrement", "before", "begin", "between",
  "by", "cascade", "case", "cast", "check", "collate", "column", "commit",
  "conflict", "constraint", "create", "cross", "current", "current_date",
  "current_time", "current_timestamp", "database", "default", "deferrable",
  "deferred", "delete", "desc", "detach", "distinct", "do", "drop", "each",
  "else", "end", "escape", "except", "exclude", "exclusive", "exists",
  "explain", "fail", "filter", "first", "following", "for", "foreign", "from",
  "full", "generated", "glob", "group", "groups", "having", "if", "ignore",
  "immediate", "in", "index", "indexed", "initially", "inner", "insert",
  "instead", "intersect", "into", "is", "isnull", "join", "key", "last",
  "left", "like", "limit", "match", "materialized", "natural", "no", "not",
  "nothing", "notnull", "null", "nulls", "of", "offset", "on", "or", "order",
  "others", "outer", "over", "partition", "plan", "pragma", "preceding",
  "primary", "query", "raise", "range", "recursive", "references", "regexp",
  "reindex", "release", "rename", "replace", "restrict", "returning", "right",
  "rollback", "row", "rows", "savepoint", "select", "set", "table", "temp",
  "temporary", "then", "ties", "to", "transaction", "trigger", "unbounded",
  "union", "unique", "update", "using", "vacuum", "values", "view", "virtual",
  "when", "where", "window", "with", "without",
]);

/** One composite index, as an authored schema carries it in `$indexes`. */
export interface SqlIndexDefinition {
  fields: string | string[];
  unique?: boolean;
  name?: string;
}

/** A statement and its bound values. */
export interface SqlQuery {
  sql: string;
  params: unknown[];
}

/** A bare column or table name, quoted only when it is a SQLite keyword. */
export function quoteIdent(name: string): string {
  const ident = String(name);
  if (!IDENT.test(ident)) throw new TypeError(`not a column name: ${ident}`);
  return SQLITE_RESERVED.has(ident.toLowerCase()) ? `"${ident}"` : ident;
}

const TYPE_MAP: Record<string, string> = {
  string: "TEXT",
  number: "REAL",
  boolean: "INTEGER",
  array: "TEXT",
  object: "TEXT",
  date: "TEXT",
  timestamp: "TEXT",
};

const sqliteType = (field: Record<string, unknown>): string => TYPE_MAP[String(field["$type"] ?? "")] ?? "TEXT";

/** The fields whose value is written as JSON text. */
export function getJsonFields(schema: ModelSchema | undefined): Set<string> {
  const fields = new Set<string>();
  for (const [name, raw] of Object.entries(schema ?? {})) {
    if (name.startsWith("$")) continue;
    const def = raw as Record<string, unknown>;
    if (def["$type"] === "array" || def["$type"] === "object") fields.add(name);
  }
  return fields;
}

/** The fields stored as SQLite's 1 or 0. */
export function getBooleanFields(schema: ModelSchema | undefined): Set<string> {
  const fields = new Set<string>();
  for (const [name, raw] of Object.entries(schema ?? {})) {
    if (name.startsWith("$")) continue;
    const def = raw as Record<string, unknown>;
    if (def["$type"] === "boolean") fields.add(name);
  }
  return fields;
}

/** Whether a model's id is a number, which SQLite assigns when the row has none. */
export const numericId = (schema: ModelSchema | undefined): boolean => (schema?.id as Record<string, unknown> | undefined)?.["$type"] === "number";

const columnDef = (field: string, raw: unknown, options: { notNull?: boolean } = { notNull: true }): string => {
  const def = raw as Record<string, unknown>;
  let column = `${quoteIdent(field)} ${sqliteType(def)}`;
  if (def["required"] === true && options.notNull !== false) column += " NOT NULL";
  const value = def["defaultValue"];
  if (value === undefined) return column;
  if (typeof value === "boolean") return `${column} DEFAULT ${value ? 1 : 0}`;
  if (typeof value === "number") return `${column} DEFAULT ${value}`;
  if (typeof value === "string") return `${column} DEFAULT '${value.replace(/'/g, "''")}'`;
  if (value === null) return `${column} DEFAULT NULL`;
  return `${column} DEFAULT '${JSON.stringify(value).replace(/'/g, "''")}'`;
};

const declaredColumns = (schema: ModelSchema): Array<[string, unknown]> => Object.entries(schema)
  .filter(([field]) => field !== "id" && !field.startsWith("$"))
  .map(([field, def]): [string, unknown] => [field, def]);

/** `CREATE TABLE IF NOT EXISTS`, its id typed by the schema. */
export function buildCreateTableSQL(model: string, schema: ModelSchema): string {
  const columns = [numericId(schema) ? "id INTEGER PRIMARY KEY" : "id TEXT PRIMARY KEY"];
  for (const [field, def] of declaredColumns(schema)) columns.push(columnDef(field, def));
  columns.push("created TEXT DEFAULT (datetime('now'))");
  columns.push("updated TEXT DEFAULT (datetime('now'))");
  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(model)} (\n  ${columns.join(",\n  ")}\n);`;
}

/** Only the columns a live table is missing; an added column is never `NOT NULL`. */
export function buildAddColumnSQL(model: string, schema: ModelSchema, existing: string[]): string[] {
  const have = new Set(existing);
  return declaredColumns(schema)
    .filter(([field]) => !have.has(field))
    .map(([field, def]) => `ALTER TABLE ${quoteIdent(model)} ADD COLUMN ${columnDef(field, def, { notNull: false })};`);
}

/** Per-field indexes plus the schema's composite `$indexes`. */
export function buildCreateIndexSQL(model: string, schema: ModelSchema, indexes: SqlIndexDefinition[] = (schema.$indexes as unknown as SqlIndexDefinition[] | undefined) ?? []): string[] {
  const statements: string[] = [];
  for (const [field, raw] of Object.entries(schema)) {
    if (field.startsWith("$") || field === "id") continue;
    const def = raw as Record<string, unknown>;
    if (def["index"] === true || def["unique"] === true) {
      const unique = def["unique"] === true ? "UNIQUE " : "";
      statements.push(`CREATE ${unique}INDEX IF NOT EXISTS idx_${quoteIdent(model)}_${quoteIdent(field)} ON ${quoteIdent(model)}(${quoteIdent(field)});`);
    }
  }
  for (const spec of indexes) {
    const fields = Array.isArray(spec.fields) ? spec.fields : [spec.fields];
    if (fields.length === 0) continue;
    const name = spec.name ?? `idx_${model}_${fields.join("_")}`;
    statements.push(`CREATE ${spec.unique === true ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quoteIdent(name)} ON ${quoteIdent(model)}(${fields.map(quoteIdent).join(", ")});`);
  }
  return statements;
}

const jsonArrayHas = (field: string, wanted: unknown[], all: boolean): SqlQuery => {
  const quoted = quoteIdent(field);
  const parts = wanted.map(() => `EXISTS (SELECT 1 FROM json_each(${quoted}) WHERE value = ?)`);
  return {
    sql: parts.length === 0 ? (all ? "1" : "0") : parts.join(all ? " AND " : " OR "),
    params: wanted,
  };
};

/** A where clause as SQLite SQL, every value bound. */
export function buildWhereClause(where: WhereClause | null | undefined): SqlQuery {
  if (!where || Object.keys(where).length === 0) return { sql: "", params: [] };

  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [field, value] of Object.entries(where)) {
    const quoted = quoteIdent(field);
    if (value === null || value === undefined) {
      conditions.push(`${quoted} IS NULL`);
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        conditions.push("0");
        continue;
      }
      conditions.push(`${quoted} IN (${value.map(() => "?").join(", ")})`);
      params.push(...value);
      continue;
    }
    if (typeof value !== "object") {
      conditions.push(`${quoted} = ?`);
      params.push(value);
      continue;
    }

    for (const [op, expected] of Object.entries(value as Record<string, unknown>)) {
      const operator = op.toLowerCase();
      switch (operator) {
        case ">":
        case ">=":
        case "<":
        case "<=":
        case "!=":
        case "<>":
        case "=":
          conditions.push(`${quoted} ${operator} ?`);
          params.push(expected);
          break;
        case "in":
        case "not in": {
          const list = Array.isArray(expected) ? expected : [];
          if (list.length === 0) {
            conditions.push(operator === "in" ? "0" : "1");
            break;
          }
          conditions.push(`${quoted} ${operator === "in" ? "IN" : "NOT IN"} (${list.map(() => "?").join(", ")})`);
          params.push(...list);
          break;
        }
        case "like":
        case "ilike":
          conditions.push(`${quoted} LIKE ?${operator === "ilike" ? " COLLATE NOCASE" : ""}`);
          params.push(expected);
          break;
        case "is null":
          conditions.push(`${quoted} IS NULL`);
          break;
        case "is not null":
          conditions.push(`${quoted} IS NOT NULL`);
          break;
        case "has":
        case "has all": {
          const wanted = Array.isArray(expected) ? expected : [expected];
          const found = jsonArrayHas(field, wanted, operator === "has all");
          conditions.push(found.sql);
          params.push(...found.params);
          break;
        }
        default:
          conditions.push(`${quoted} = ?`);
          params.push(expected);
      }
    }
  }

  return { sql: conditions.join(" AND "), params };
}

const orderOf = (order: QueryOptions["order"]): OrderSpec[] => {
  if (order === undefined) return [];
  return typeof order === "string" ? parseOrder(order) : order;
};

const selectFields = (fields: string[] | undefined): string => {
  if (fields === undefined || fields.length === 0) return "*";
  return fields.map(quoteIdent).join(", ");
};

/** A select over `model`, with `where`, `order`, `limit`, `offset` and `fields`. */
export function buildSelectSQL(model: string, options: QueryOptions = {}): SqlQuery {
  const { where, order, limit, offset, fields } = options;
  let sql = `SELECT ${selectFields(fields)} FROM ${quoteIdent(model)}`;
  const params: unknown[] = [];
  const clause = buildWhereClause(where);
  if (clause.sql !== "") {
    sql += ` WHERE ${clause.sql}`;
    params.push(...clause.params);
  }
  const parts = orderOf(order);
  if (parts.length > 0) sql += ` ORDER BY ${parts.map((part) => `${quoteIdent(part.field)} ${String(part.direction).toUpperCase() === "DESC" ? "DESC" : "ASC"}`).join(", ")}`;
  if (limit !== undefined) {
    sql += " LIMIT ?";
    params.push(limit);
    if (offset !== undefined) {
      sql += " OFFSET ?";
      params.push(offset);
    }
  }
  return { sql, params };
}

const storedValue = (field: string, value: unknown, jsonFields: Set<string>): unknown => {
  if (value === undefined) return null;
  if (jsonFields.has(field) && value !== null) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
};

/** An insert; a missing id lets SQLite assign one when the model's id is numeric. */
export function buildInsertSQL(model: string, data: Record<string, unknown>, jsonFields: Set<string> = new Set()): SqlQuery {
  const fields = Object.keys(data).filter((field) => data[field] !== undefined && !(field === "id" && data[field] === null));
  if (fields.length === 0) return { sql: `INSERT INTO ${quoteIdent(model)} DEFAULT VALUES`, params: [] };
  return {
    sql: `INSERT INTO ${quoteIdent(model)} (${fields.map(quoteIdent).join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`,
    params: fields.map((field) => storedValue(field, data[field], jsonFields)),
  };
}

/** An update of every field given, stamping `updated`; never changes `id` or `created`. */
export function buildUpdateSQL(model: string, id: string | number, data: Record<string, unknown>, jsonFields: Set<string> = new Set()): SqlQuery {
  const fields = Object.keys(data).filter((field) => field !== "id" && field !== "created" && data[field] !== undefined);
  const parts = fields.map((field) => `${quoteIdent(field)} = ?`);
  parts.push("updated = datetime('now')");
  return {
    sql: `UPDATE ${quoteIdent(model)} SET ${parts.join(", ")} WHERE id = ?`,
    params: [...fields.map((field) => storedValue(field, data[field], jsonFields)), id],
  };
}

/** A delete by id. */
export function buildDeleteSQL(model: string, id: string | number): SqlQuery {
  return { sql: `DELETE FROM ${quoteIdent(model)} WHERE id = ?`, params: [id] };
}

/** A count over the same where. */
export function buildCountSQL(model: string, options: QueryOptions = {}): SqlQuery {
  const clause = buildWhereClause(options.where);
  return {
    sql: `SELECT COUNT(*) AS count FROM ${quoteIdent(model)}${clause.sql === "" ? "" : ` WHERE ${clause.sql}`}`,
    params: clause.params,
  };
}

/** The live column names of a table. */
export function tableColumns(db: { prepare(sql: string): { all(params?: unknown[]): Record<string, unknown>[] } }, model: string): string[] {
  return db.prepare(`PRAGMA table_info(${quoteIdent(model)})`).all().map((row) => String(row["name"]));
}

/**
 * Apply a schema additively: create a missing table, add missing columns, and
 * create indexes. A destructive change belongs in an explicit migration.
 */
export function applySchema(db: { prepare(sql: string): { all(params?: unknown[]): Record<string, unknown>[] }, exec(sql: string): void }, models: Record<string, ModelSchema>): void {
  for (const [model, schema] of Object.entries(models)) {
    if (model.startsWith("$")) continue;
    db.exec(buildCreateTableSQL(model, schema));
    for (const sql of buildAddColumnSQL(model, schema, tableColumns(db, model))) db.exec(sql);
    for (const sql of buildCreateIndexSQL(model, schema)) db.exec(sql);
  }
}

/** One explicit migration: a name that runs once, and the SQL it runs. */
export interface SqlMigration {
  name: string;
  sql: string | string[];
}

/**
 * Run the migrations a database has not recorded in `_migrations`, each in
 * one transaction. The table is created here, so the first run needs nothing.
 */
export function applyMigrations(db: { prepare(sql: string): { all(params?: unknown[]): Record<string, unknown>[], run(params?: unknown[]): unknown }, exec(sql: string): void, transaction(fn: () => void): void }, migrations: SqlMigration[]): void {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied TEXT NOT NULL DEFAULT (datetime('now')))");
  const applied = new Set(db.prepare("SELECT name FROM _migrations").all().map((row) => String(row["name"])));
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      for (const sql of Array.isArray(migration.sql) ? migration.sql : [migration.sql]) db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run([migration.name]);
    });
  }
}

export default {
  applyMigrations,
  applySchema,
  buildAddColumnSQL,
  buildCountSQL,
  buildCreateIndexSQL,
  buildCreateTableSQL,
  buildDeleteSQL,
  buildInsertSQL,
  buildSelectSQL,
  buildUpdateSQL,
  buildWhereClause,
  getBooleanFields,
  getJsonFields,
  quoteIdent,
  tableColumns,
};
