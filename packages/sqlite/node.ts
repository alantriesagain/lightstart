/**
 * @lightstart/sqlite/node: the synchronous driver over node:sqlite. Same
 * classes and behaviour as the native driver, reached only where node's own
 * SQLite is available; scriptc refuses this import, so a native app imports
 * `@lightstart/sqlite/native` instead.
 */

import { DatabaseSync } from "node:sqlite";
import { DEFAULT_STATEMENT_CACHE, openPragmas } from "./index.ts";

import type { OpenOptions, SqlDatabase, SqlParams, SqlRunResult, SqlStatement } from "./index.ts";

/** A boolean is SQLite's 1 or 0; an array or object is its JSON text; undefined is null. */
export const toNodeValue = (value: unknown): string | number | bigint | null | Uint8Array => {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || value instanceof Uint8Array) return value;
  return JSON.stringify(value);
};

const normalizeId = (value: number | bigint): number | bigint =>
  typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;

const paramsOf = (params: SqlParams | undefined): SqlParams => (params === undefined ? [] : params);

const bindings = (params: SqlParams | undefined): Array<string | number | bigint | null | Uint8Array> | Record<string, string | number | bigint | null | Uint8Array> => {
  const given = paramsOf(params);
  if (Array.isArray(given)) return given.map((value) => toNodeValue(value));
  const named: Record<string, string | number | bigint | null | Uint8Array> = {};
  for (const [key, value] of Object.entries(given)) named[key] = toNodeValue(value);
  return named;
};

/** One prepared statement on node's engine. */
export class Statement implements SqlStatement {
  private readonly statement: ReturnType<DatabaseSync["prepare"]>;

  constructor(statement: ReturnType<DatabaseSync["prepare"]>) {
    this.statement = statement;
  }

  all(params?: SqlParams): Record<string, unknown>[] {
    const bound = bindings(params);
    const rows = Array.isArray(bound) ? this.statement.all(...bound) : this.statement.all(bound);
    return rows as Record<string, unknown>[];
  }

  get(params?: SqlParams): Record<string, unknown> | null {
    const bound = bindings(params);
    const row = Array.isArray(bound) ? this.statement.get(...bound) : this.statement.get(bound);
    return (row as Record<string, unknown> | undefined) ?? null;
  }

  run(params?: SqlParams): SqlRunResult {
    const bound = bindings(params);
    const result = Array.isArray(bound) ? this.statement.run(...bound) : this.statement.run(bound);
    return { changes: Number(result.changes), lastId: normalizeId(result.lastInsertRowid) };
  }

  json(params?: SqlParams): string {
    return JSON.stringify(this.all(params));
  }

  close(): void {}
}

/** One database file (or `:memory:`) on node's engine. */
export class Database implements SqlDatabase {
  readonly path: string;
  private readonly database: DatabaseSync;
  private readonly cache: Map<string, Statement>;
  private readonly maxStatements: number;
  private depth: number;
  private active: boolean;

  private constructor(path: string, database: DatabaseSync, maxStatements: number) {
    this.path = path;
    this.database = database;
    this.cache = new Map();
    this.maxStatements = maxStatements;
    this.depth = 0;
    this.active = true;
  }

  /** Open `path`, run the pragmas, and answer the database. */
  static open(path: string, options: OpenOptions = {}): Database {
    const database = new DatabaseSync(path, { readOnly: options.readOnly === true });
    const db = new Database(path, database, options.cacheStatements ?? DEFAULT_STATEMENT_CACHE);
    for (const sql of openPragmas(options)) database.exec(sql);
    return db;
  }

  get open(): boolean {
    return this.active;
  }

  prepare(sql: string): Statement {
    const cached = this.cache.get(sql);
    if (cached !== undefined) {
      this.cache.delete(sql);
      this.cache.set(sql, cached);
      return cached;
    }
    const statement = new Statement(this.database.prepare(sql));
    this.cache.set(sql, statement);
    while (this.cache.size > this.maxStatements) {
      const oldest = this.cache.keys().next();
      if (oldest.done === true) break;
      const stale = this.cache.get(oldest.value);
      this.cache.delete(oldest.value);
      if (stale !== undefined) stale.close();
    }
    return statement;
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  transaction(fn: () => void): void {
    const nested = this.depth > 0;
    const name = `sp_${this.depth}`;
    this.database.exec(nested ? `SAVEPOINT ${name}` : "BEGIN IMMEDIATE");
    this.depth += 1;
    try {
      const value = fn();
      this.depth -= 1;
      this.database.exec(nested ? `RELEASE ${name}` : "COMMIT");
      return value;
    } catch (error) {
      this.depth -= 1;
      try {
        this.database.exec(nested ? `ROLLBACK TO ${name}` : "ROLLBACK");
        if (nested) this.database.exec(`RELEASE ${name}`);
      } catch {
        this.depth = 0;
      }
      throw error;
    }
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    for (const statement of this.cache.values()) statement.close();
    this.cache.clear();
    this.database.close();
  }
}
