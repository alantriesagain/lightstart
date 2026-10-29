/**
 * @lightstart/sqlite/native: the same driver as `./node.ts`, over the C shim
 * that links SQLite's amalgamation into the binary. A result crosses as JSON
 * text built in C, so `json()` costs one FFI call and builds no row objects.
 */

import { DEFAULT_STATEMENT_CACHE, openPragmas } from "./index.ts";

import type { OpenOptions, SqlDatabase, SqlParams, SqlRunResult, SqlStatement } from "./index.ts";

declare function sqlite_shim_open(path: string, readOnly: number): bigint;
declare function sqlite_shim_close(db: bigint): void;
declare function sqlite_shim_errmsg(db: bigint, buffer: Uint8Array): number;
declare function sqlite_shim_prepare(db: bigint, sql: string): bigint;
declare function sqlite_shim_finalize(statement: bigint): number;
declare function sqlite_shim_bind_null(statement: bigint, index: number): number;
declare function sqlite_shim_bind_double(statement: bigint, index: number, value: number): number;
declare function sqlite_shim_bind_int(statement: bigint, index: number, value: bigint): number;
declare function sqlite_shim_bind_text(statement: bigint, index: number, value: string): number;
declare function sqlite_shim_bind_blob(statement: bigint, index: number, value: Uint8Array): number;
declare function sqlite_shim_bind_index(statement: bigint, name: string): number;
declare function sqlite_shim_clear_bindings(statement: bigint): number;
declare function sqlite_shim_reset(statement: bigint): number;
declare function sqlite_shim_json(statement: bigint, buffer: Uint8Array): bigint;
declare function sqlite_shim_run(statement: bigint): number;
declare function sqlite_shim_changes(db: bigint): bigint;
declare function sqlite_shim_last_id(db: bigint): bigint;
declare function sqlite_shim_exec(db: bigint, sql: string): number;

const SQLITE_ROW = 100;
const SQLITE_DONE = 101;
const JSON_NEED = -2;
const GROW_START = 4096;

const decoder = new TextDecoder();

const messageOf = (db: bigint): string => {
  let size = 256;
  for (;;) {
    const buffer = new Uint8Array(size);
    const length = sqlite_shim_errmsg(db, buffer);
    if (length >= 0 && length < size) return decoder.decode(buffer.subarray(0, length));
    size = length < 0 ? -length : size * 2;
  }
};

/** A boolean is SQLite's 1 or 0; an array or object is its JSON text; undefined is null. */
const bindOne = (statement: bigint, index: number, value: unknown): void => {
  let code = 0;
  if (value === undefined || value === null) code = sqlite_shim_bind_null(statement, index);
  else if (typeof value === "boolean") code = sqlite_shim_bind_int(statement, index, value ? 1n : 0n);
  else if (typeof value === "bigint") code = sqlite_shim_bind_int(statement, index, value);
  else if (typeof value === "number") code = Number.isSafeInteger(value) ? sqlite_shim_bind_int(statement, index, BigInt(value)) : sqlite_shim_bind_double(statement, index, value);
  else if (value instanceof Uint8Array) code = sqlite_shim_bind_blob(statement, index, value);
  else if (typeof value === "string") code = sqlite_shim_bind_text(statement, index, value);
  else code = sqlite_shim_bind_text(statement, index, JSON.stringify(value));
  if (code !== 0) throw new Error(`sqlite: bind ${index} failed with ${code}`);
};

const bindParams = (statement: bigint, params: SqlParams | undefined): void => {
  sqlite_shim_reset(statement);
  sqlite_shim_clear_bindings(statement);
  if (params === undefined) return;
  if (Array.isArray(params)) {
    for (const [index, value] of params.entries()) bindOne(statement, index + 1, value);
    return;
  }
  for (const [key, value] of Object.entries(params)) {
    let index = sqlite_shim_bind_index(statement, `:${key}`);
    if (index === 0) index = sqlite_shim_bind_index(statement, `@${key}`);
    if (index === 0) index = sqlite_shim_bind_index(statement, `$${key}`);
    if (index === 0) throw new Error(`sqlite: no parameter named "${key}"`);
    bindOne(statement, index, value);
  }
};

/** One prepared statement over the shim. */
export class Statement implements SqlStatement {
  private readonly db: bigint;
  readonly handle: bigint;
  private closed: boolean;

  constructor(db: bigint, handle: bigint) {
    this.db = db;
    this.handle = handle;
    this.closed = false;
  }

  all(params?: SqlParams): Record<string, unknown>[] {
    return JSON.parse(this.json(params)) as Record<string, unknown>[];
  }

  get(params?: SqlParams): Record<string, unknown> | null {
    const rows = this.all(params);
    return rows.length > 0 ? rows[0] : null;
  }

  run(params?: SqlParams): SqlRunResult {
    if (this.closed) throw new Error("sqlite: statement is closed");
    bindParams(this.handle, params);
    const code = sqlite_shim_run(this.handle);
    sqlite_shim_reset(this.handle);
    sqlite_shim_clear_bindings(this.handle);
    if (code !== SQLITE_DONE && code !== SQLITE_ROW) throw new Error(`sqlite: ${messageOf(this.db)}`);
    const lastId = sqlite_shim_last_id(this.db);
    return { changes: Number(sqlite_shim_changes(this.db)), lastId: lastId <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(lastId) : lastId };
  }

  json(params?: SqlParams): string {
    if (this.closed) throw new Error("sqlite: statement is closed");
    bindParams(this.handle, params);
    sqlite_shim_reset(this.handle);
    let size = GROW_START;
    for (;;) {
      const buffer = new Uint8Array(size);
      const length = sqlite_shim_json(this.handle, buffer);
      if (length === BigInt(JSON_NEED)) {
        sqlite_shim_reset(this.handle);
        throw new Error(`sqlite: ${messageOf(this.db)}`);
      }
      if (length < 0) {
        size = Number(-length);
        continue;
      }
      return decoder.decode(buffer.subarray(0, Number(length)));
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    sqlite_shim_finalize(this.handle);
  }
}

/** One database file (or `:memory:`) over the shim. */
export class Database implements SqlDatabase {
  readonly path: string;
  private readonly db: bigint;
  private readonly cache: Map<string, Statement>;
  private readonly maxStatements: number;
  private depth: number;
  private active: boolean;

  private constructor(path: string, db: bigint, maxStatements: number) {
    this.path = path;
    this.db = db;
    this.cache = new Map();
    this.maxStatements = maxStatements;
    this.depth = 0;
    this.active = true;
  }

  /** Open `path`, run the pragmas, and answer the database. */
  static open(path: string, options: OpenOptions = {}): Database {
    const handle = sqlite_shim_open(path, options.readOnly === true ? 1 : 0);
    if (handle === 0n) throw new Error(`sqlite: cannot open ${path}`);
    const db = new Database(path, handle, options.cacheStatements ?? DEFAULT_STATEMENT_CACHE);
    for (const sql of openPragmas(options)) db.exec(sql);
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
    const handle = sqlite_shim_prepare(this.db, sql);
    if (handle === 0n) throw new Error(`sqlite: ${messageOf(this.db)}`);
    const statement = new Statement(this.db, handle);
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
    const code = sqlite_shim_exec(this.db, sql);
    if (code !== 0) throw new Error(`sqlite: ${messageOf(this.db)}`);
  }

  transaction(fn: () => void): void {
    const nested = this.depth > 0;
    const name = `sp_${this.depth}`;
    this.exec(nested ? `SAVEPOINT ${name}` : "BEGIN IMMEDIATE");
    this.depth += 1;
    try {
      fn();
      this.depth -= 1;
      this.exec(nested ? `RELEASE ${name}` : "COMMIT");
    } catch (error) {
      this.depth -= 1;
      try {
        this.exec(nested ? `ROLLBACK TO ${name}` : "ROLLBACK");
        if (nested) this.exec(`RELEASE ${name}`);
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
    sqlite_shim_close(this.db);
  }
}
