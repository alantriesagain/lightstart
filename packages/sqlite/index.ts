/**
 * @lightstart/sqlite: the shape a synchronous SQLite driver has, shared by
 * the node driver (`@lightstart/sqlite/node`) and the native one
 * (`@lightstart/sqlite/native`). A database prepares cached statements; each
 * statement binds parameters, steps its rows, and answers a whole result as
 * JSON text without building JavaScript row objects. The dialect, the
 * pragmas and the transaction rules are the same in both runtimes.
 */

/** The parameters of one call: positional, or named without the `:` / `@` / `$` prefix. */
export type SqlParams = unknown[] | Record<string, unknown>;

/** What `run` answers: the rows the statement changed and the last inserted id. */
export interface SqlRunResult {
  changes: number;
  lastId: number | bigint;
}

/** A prepared statement, owned by the database that made it. */
export interface SqlStatement {
  all(params?: SqlParams): Record<string, unknown>[];
  get(params?: SqlParams): Record<string, unknown> | null;
  run(params?: SqlParams): SqlRunResult;
  /** The whole result as one JSON array of objects, built by the engine where it can be. */
  json(params?: SqlParams): string;
  readonly reader: boolean;
  readonly columns: number;
  close(): void;
}

/** A synchronous database: prepare, execute, transact, close. */
export interface SqlDatabase {
  readonly path: string;
  readonly open: boolean;
  prepare(sql: string): SqlStatement;
  exec(sql: string): void;
  /** Run `fn` inside `BEGIN IMMEDIATE`; a call made inside another gets its own savepoint. */
  transaction<T>(fn: () => T): T;
  close(): void;
}

/** Whether a callback answered a promise, which a transaction refuses. */
export const isThenable = (value: unknown): boolean =>
  value !== null && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";

/** How a database is opened. Every pragma has a safe default; a writable database keeps them unless told otherwise. */
export interface OpenOptions {
  readOnly?: boolean;
  journalMode?: "WAL" | "DELETE" | "TRUNCATE" | "PERSIST" | "MEMORY" | "OFF";
  synchronous?: "OFF" | "NORMAL" | "FULL" | "EXTRA";
  foreignKeys?: boolean;
  busyTimeout?: number;
  cacheSize?: number;
  mmapSize?: number;
  /** How many prepared statements one database keeps; the least recently prepared is finalized past it. */
  cacheStatements?: number;
}

/** The value a `PRAGMA` line may carry: a number checked finite, or one of the words above. */
const numberPragma = (value: number): string => {
  if (!Number.isFinite(value)) throw new TypeError(`not a finite pragma value: ${String(value)}`);
  return String(Math.trunc(value));
};

/**
 * The pragmas an open runs, in order. WAL lets readers work while one writer
 * holds the file; `busy_timeout` covers another process (Litestream, a CLI).
 */
export const openPragmas = (options: OpenOptions = {}): string[] => {
  const lines: string[] = [];
  if (options.readOnly !== true) {
    lines.push(`PRAGMA journal_mode = ${options.journalMode ?? "WAL"}`);
    lines.push(`PRAGMA synchronous = ${options.synchronous ?? "NORMAL"}`);
  }
  lines.push(`PRAGMA busy_timeout = ${numberPragma(options.busyTimeout ?? 5000)}`);
  lines.push(`PRAGMA foreign_keys = ${options.foreignKeys === false ? "OFF" : "ON"}`);
  lines.push("PRAGMA temp_store = MEMORY");
  if (options.cacheSize !== undefined) lines.push(`PRAGMA cache_size = ${numberPragma(options.cacheSize)}`);
  if (options.mmapSize !== undefined) lines.push(`PRAGMA mmap_size = ${numberPragma(options.mmapSize)}`);
  return lines;
};

/** The default number of prepared statements one database keeps. */
export const DEFAULT_STATEMENT_CACHE = 128;
