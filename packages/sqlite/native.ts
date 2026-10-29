/**
 * @lightstart/sqlite/native: the same driver as `./node.ts`, over the C shim
 * that links SQLite's amalgamation into the binary. A result crosses as JSON
 * text built in C, so `json()` costs one FFI call and builds no row objects.
 */

import { DEFAULT_STATEMENT_CACHE, isThenable, openPragmas } from "./index.ts";

import type { OpenOptions, SqlDatabase, SqlParams, SqlRunResult, SqlStatement } from "./index.ts";

declare function sqlite_shim_open(path: string, readOnly: number): bigint;
declare function sqlite_shim_close(db: bigint): void;
declare function sqlite_shim_errmsg(db: bigint, buffer: Uint8Array): number;
declare function sqlite_shim_prepare(db: bigint, sql: string): bigint;
declare function sqlite_shim_finalize(statement: bigint): number;
declare function sqlite_shim_bind_null(statement: bigint, index: number): number;
declare function sqlite_shim_bind_double(statement: bigint, index: number, value: number): number;
declare function sqlite_shim_bind_int(statement: bigint, index: number, value: bigint): number;
declare function sqlite_shim_bind_int32(statement: bigint, index: number, value: number): number;
declare function sqlite_shim_bind_text(statement: bigint, index: number, value: string): number;
declare function sqlite_shim_bind_blob(statement: bigint, index: number, value: Uint8Array): number;
declare function sqlite_shim_bind_index(statement: bigint, name: string): number;
declare function sqlite_shim_clear_bindings(statement: bigint): number;
declare function sqlite_shim_ready(statement: bigint): number;
declare function sqlite_shim_reset(statement: bigint): number;
declare function sqlite_shim_json(statement: bigint, buffer: Uint8Array): bigint;
declare function sqlite_shim_row(statement: bigint, buffer: Uint8Array): bigint;
declare function sqlite_shim_get_text(statement: bigint, value: string, call: number, buffer: Uint8Array): bigint;
declare function sqlite_shim_get_int(statement: bigint, value: bigint, call: number, buffer: Uint8Array): bigint;
declare function sqlite_shim_readonly(statement: bigint): number;
declare function sqlite_shim_columns(statement: bigint): number;
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
  else if (typeof value === "number") code = Number.isSafeInteger(value) ? (value >= -2147483648 && value <= 2147483647 ? sqlite_shim_bind_int32(statement, index, value) : sqlite_shim_bind_int(statement, index, BigInt(value))) : sqlite_shim_bind_double(statement, index, value);
  else if (value instanceof Uint8Array) code = sqlite_shim_bind_blob(statement, index, value);
  else if (typeof value === "string") code = sqlite_shim_bind_text(statement, index, value);
  else code = sqlite_shim_bind_text(statement, index, JSON.stringify(value));
  if (code !== 0) throw new Error(`sqlite: bind ${index} failed with ${code}`);
};

const bindParams = (statement: bigint, params: SqlParams | undefined): void => {
  sqlite_shim_ready(statement);
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
  readonly reader: boolean;
  readonly columns: number;
  private readonly buffer: { bytes: Uint8Array };
  private call: number;
  private closed: boolean;

  constructor(db: bigint, handle: bigint, buffer: { bytes: Uint8Array }) {
    this.db = db;
    this.handle = handle;
    this.reader = sqlite_shim_readonly(handle) === 1;
    this.columns = sqlite_shim_columns(handle);
    this.buffer = buffer;
    this.call = 0;
    this.closed = false;
  }

  all(params?: SqlParams): Record<string, unknown>[] {
    return JSON.parse(this.json(params)) as Record<string, unknown>[];
  }

  get(params?: SqlParams): Record<string, unknown> | null {
    if (this.closed) throw new Error("sqlite: statement is closed");
    if (Array.isArray(params) && params.length === 1) {
      const value = params[0];
      if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
        const call = this.call++ >>> 0;
        const text = typeof value === "string";
        for (;;) {
          const length = text ? sqlite_shim_get_text(this.handle, value as string, call, this.buffer.bytes) : sqlite_shim_get_int(this.handle, BigInt(value as number | bigint), call, this.buffer.bytes);
          if (length === BigInt(JSON_NEED)) throw new Error(`sqlite: ${messageOf(this.db)}`);
          if (length < 0) {
            this.buffer.bytes = new Uint8Array(Number(-length));
            continue;
          }
          const result = decoder.decode(this.buffer.bytes.subarray(0, Number(length)));
          return result === "null" ? null : JSON.parse(result) as Record<string, unknown>;
        }
      }
    }
    bindParams(this.handle, params);
    for (;;) {
      const length = sqlite_shim_row(this.handle, this.buffer.bytes);
      if (length === BigInt(JSON_NEED)) {
        sqlite_shim_reset(this.handle);
        throw new Error(`sqlite: ${messageOf(this.db)}`);
      }
      if (length < 0) {
        this.buffer.bytes = new Uint8Array(Number(-length));
        continue;
      }
      const text = decoder.decode(this.buffer.bytes.subarray(0, Number(length)));
      return text === "null" ? null : JSON.parse(text) as Record<string, unknown>;
    }
  }

  run(params?: SqlParams): SqlRunResult {
    if (this.closed) throw new Error("sqlite: statement is closed");
    bindParams(this.handle, params);
    const code = sqlite_shim_run(this.handle);
    if (code !== SQLITE_DONE && code !== SQLITE_ROW) throw new Error(`sqlite: ${messageOf(this.db)}`);
    const lastId = sqlite_shim_last_id(this.db);
    return { changes: this.reader ? 0 : Number(sqlite_shim_changes(this.db)), lastId: lastId <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(lastId) : lastId };
  }

  json(params?: SqlParams): string {
    if (this.closed) throw new Error("sqlite: statement is closed");
    bindParams(this.handle, params);
    for (;;) {
      const length = sqlite_shim_json(this.handle, this.buffer.bytes);
      if (length === BigInt(JSON_NEED)) {
        sqlite_shim_reset(this.handle);
        throw new Error(`sqlite: ${messageOf(this.db)}`);
      }
      if (length < 0) {
        this.buffer.bytes = new Uint8Array(Number(-length));
        continue;
      }
      return decoder.decode(this.buffer.bytes.subarray(0, Number(length)));
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
  private readonly statements: Set<Statement>;
  private readonly maxStatements: number;
  private readonly buffer: { bytes: Uint8Array };
  private depth: number;
  private active: boolean;

  private constructor(path: string, db: bigint, maxStatements: number) {
    this.path = path;
    this.db = db;
    this.cache = new Map();
    this.statements = new Set();
    this.maxStatements = maxStatements;
    this.buffer = { bytes: new Uint8Array(GROW_START) };
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
    const statement = new Statement(this.db, handle, this.buffer);
    this.statements.add(statement);
    this.cache.set(sql, statement);
    while (this.cache.size > this.maxStatements) {
      const oldest = this.cache.keys().next();
      if (oldest.done === true) break;
      this.cache.delete(oldest.value);
    }
    return statement;
  }

  exec(sql: string): void {
    const code = sqlite_shim_exec(this.db, sql);
    if (code !== 0) throw new Error(`sqlite: ${messageOf(this.db)}`);
  }

  transaction<T>(fn: () => T): T {
    const nested = this.depth > 0;
    const name = `sp_${this.depth}`;
    this.exec(nested ? `SAVEPOINT ${name}` : "BEGIN IMMEDIATE");
    this.depth += 1;
    try {
      const value = fn();
      if (isThenable(value)) throw new Error("sqlite: a transaction body must be synchronous");
      this.exec(nested ? `RELEASE ${name}` : "COMMIT");
      return value;
    } catch (error) {
      try {
        this.exec(nested ? `ROLLBACK TO ${name}` : "ROLLBACK");
        if (nested) this.exec(`RELEASE ${name}`);
      } catch {}
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  close(): void {
    if (!this.active) return;
    this.active = false;
    for (const statement of this.statements) statement.close();
    this.cache.clear();
    this.statements.clear();
    sqlite_shim_close(this.db);
  }
}
