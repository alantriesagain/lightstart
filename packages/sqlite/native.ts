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
declare function sqlite_shim_get_text(statement: bigint, value: string, buffer: Uint8Array): bigint;
declare function sqlite_shim_get_int(statement: bigint, value: bigint, buffer: Uint8Array): bigint;
declare function sqlite_shim_columns(statement: bigint): number;
declare function sqlite_shim_run(statement: bigint, out: Uint8Array): number;
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
    for (let index = 0; index < params.length; index++) bindOne(statement, index + 1, params[index]);
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

/** The little-endian int64 at `at` in `bytes`: a number while it is safe, else a bigint. */
const int64At = (bytes: Uint8Array, at: number): number | bigint => {
  const low = (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16)) + bytes[at + 3]! * 16777216;
  const high = (bytes[at + 4]! | (bytes[at + 5]! << 8) | (bytes[at + 6]! << 16)) + bytes[at + 7]! * 16777216;
  if (high < 2097152) return high * 4294967296 + low;
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[at + i]!);
  return value >= 9223372036854775808n ? value - 18446744073709551616n : value;
};

/** The JSON the shim wrote into the buffer, or null when the buffer was short and has grown to the size it needs. */
const readInto = (db: bigint, holder: { bytes: Uint8Array }, length: bigint): string | null => {
  if (length === BigInt(JSON_NEED)) throw new Error(`sqlite: ${messageOf(db)}`);
  if (length < 0) {
    holder.bytes = new Uint8Array(Number(-length));
    return null;
  }
  return decoder.decode(holder.bytes.subarray(0, Number(length)));
};

/**
 * One prepared statement over the shim. The database's cache owns its handle:
 * when the statement is evicted the handle is finalized, and the next call
 * prepares it again, so a caller may hold a statement for as long as the
 * database is open while the live handles stay bounded by the cache.
 */
export class Statement implements SqlStatement {
  readonly sql: string;
  private readonly owner: Database;
  private handle: bigint;
  readonly columns: number;

  constructor(owner: Database, sql: string, handle: bigint) {
    this.owner = owner;
    this.sql = sql;
    this.handle = handle;
    this.columns = sqlite_shim_columns(handle);
  }

  /** The live handle, prepared again if the cache evicted it. */
  private live(): bigint {
    if (this.handle === 0n) this.handle = this.owner.revive(this);
    return this.handle;
  }

  /** Finalize the handle; the statement stays usable and prepares again when called. */
  release(): void {
    if (this.handle === 0n) return;
    sqlite_shim_finalize(this.handle);
    this.handle = 0n;
  }

  all(params?: SqlParams): Record<string, unknown>[] {
    return JSON.parse(this.json(params)) as Record<string, unknown>[];
  }

  get(params?: SqlParams): Record<string, unknown> | null {
    const handle = this.live();
    const buffer = this.owner.buffer;
    let length: bigint;
    const value = Array.isArray(params) && params.length === 1 ? params[0] : undefined;
    if (typeof value === "string") length = sqlite_shim_get_text(handle, value, buffer.bytes);
    else if (typeof value === "bigint" || (typeof value === "number" && Number.isSafeInteger(value))) length = sqlite_shim_get_int(handle, BigInt(value), buffer.bytes);
    else {
      bindParams(handle, params);
      length = sqlite_shim_row(handle, buffer.bytes);
    }
    for (;;) {
      const text = readInto(this.owner.handle, buffer, length);
      if (text !== null) return text === "null" ? null : JSON.parse(text) as Record<string, unknown>;
      length = sqlite_shim_row(handle, buffer.bytes);
    }
  }

  run(params?: SqlParams): SqlRunResult {
    const handle = this.live();
    bindParams(handle, params);
    const out = this.owner.counts;
    const code = sqlite_shim_run(handle, out);
    if (code !== SQLITE_DONE && code !== SQLITE_ROW) throw new Error(`sqlite: ${messageOf(this.owner.handle)}`);
    return { changes: Number(int64At(out, 0)), lastId: int64At(out, 8) };
  }

  json(params?: SqlParams): string {
    const handle = this.live();
    const buffer = this.owner.buffer;
    bindParams(handle, params);
    for (;;) {
      const length = sqlite_shim_json(handle, buffer.bytes);
      if (length === BigInt(JSON_NEED)) sqlite_shim_reset(handle);
      const text = readInto(this.owner.handle, buffer, length);
      if (text !== null) return text;
    }
  }

  /** Drop the statement from its database's cache and finalize it. */
  close(): void {
    this.owner.forget(this);
  }
}

/** One database file (or `:memory:`) over the shim. */
export class Database implements SqlDatabase {
  readonly path: string;
  readonly handle: bigint;
  /** The JSON buffer every statement of this database writes into; it only grows. */
  readonly buffer: { bytes: Uint8Array };
  /** Where a run's changes and last rowid come back. */
  readonly counts: Uint8Array;
  private readonly cache: Map<string, Statement>;
  private readonly maxStatements: number;
  private depth: number;
  private active: boolean;

  private constructor(path: string, handle: bigint, maxStatements: number) {
    this.path = path;
    this.handle = handle;
    this.buffer = { bytes: new Uint8Array(GROW_START) };
    this.counts = new Uint8Array(16);
    this.cache = new Map();
    this.maxStatements = Math.max(1, maxStatements);
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

  private compile(sql: string): bigint {
    if (!this.active) throw new Error("sqlite: database is closed");
    const handle = sqlite_shim_prepare(this.handle, sql);
    if (handle === 0n) throw new Error(`sqlite: ${messageOf(this.handle)}`);
    return handle;
  }

  /** Put `statement` at the cache's newest end, finalizing the oldest past the limit. */
  private admit(statement: Statement): void {
    this.cache.set(statement.sql, statement);
    while (this.cache.size > this.maxStatements) {
      const oldest = this.cache.keys().next();
      if (oldest.done === true) break;
      const stale = this.cache.get(oldest.value);
      this.cache.delete(oldest.value);
      if (stale !== undefined) stale.release();
    }
  }

  prepare(sql: string): Statement {
    const cached = this.cache.get(sql);
    if (cached !== undefined) {
      this.cache.delete(sql);
      this.cache.set(sql, cached);
      return cached;
    }
    const statement = new Statement(this, sql, this.compile(sql));
    this.admit(statement);
    return statement;
  }

  /** A fresh handle for a statement the cache evicted, and its place back in the cache. */
  revive(statement: Statement): bigint {
    const handle = this.compile(statement.sql);
    const holder = this.cache.get(statement.sql);
    if (holder !== undefined && holder !== statement) holder.release();
    this.cache.delete(statement.sql);
    this.admit(statement);
    return handle;
  }

  /** Drop `statement` from the cache and finalize its handle. */
  forget(statement: Statement): void {
    if (this.cache.get(statement.sql) === statement) this.cache.delete(statement.sql);
    statement.release();
  }

  exec(sql: string): void {
    if (!this.active) throw new Error("sqlite: database is closed");
    const code = sqlite_shim_exec(this.handle, sql);
    if (code !== 0) throw new Error(`sqlite: ${messageOf(this.handle)}`);
  }

  /** Run one of the transaction statements through the cache, so a transaction parses no SQL. */
  private control(sql: string): void {
    this.prepare(sql).run();
  }

  transaction<T>(fn: () => T): T {
    const nested = this.depth > 0;
    const name = `sp_${this.depth}`;
    this.control(nested ? `SAVEPOINT ${name}` : "BEGIN IMMEDIATE");
    this.depth += 1;
    try {
      const value = fn();
      if (isThenable(value)) throw new Error("sqlite: a transaction body must be synchronous");
      this.control(nested ? `RELEASE ${name}` : "COMMIT");
      return value;
    } catch (error) {
      try {
        this.control(nested ? `ROLLBACK TO ${name}` : "ROLLBACK");
        if (nested) this.control(`RELEASE ${name}`);
      } catch {}
      throw error;
    } finally {
      this.depth -= 1;
    }
  }

  close(): void {
    if (!this.active) return;
    for (const statement of this.cache.values()) statement.release();
    this.cache.clear();
    this.active = false;
    sqlite_shim_close(this.handle);
  }
}
