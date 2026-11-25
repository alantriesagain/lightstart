/**
 * @file The D1 seam `@lightstart/api/server` runs on: the small async shape
 * Cloudflare's D1 binding and `d1Of(db)` from `@lightstart/sqlite` both
 * satisfy. Every call is a promise, so the CRUD app runs unchanged on a
 * Worker's binding or on a local SQLite file.
 */

/** The metadata D1 puts on a result, narrowed to what a server reads. */
export interface D1MetaLike {
  changes?: number;
  last_row_id?: number | string;
  duration?: number;
  changed_db?: boolean;
}

/** What `all` and `run` answer: the rows of a query, and the metadata of a write. */
export interface D1Result {
  results?: Record<string, unknown>[];
  success?: boolean;
  meta?: D1MetaLike;
}

/** One prepared statement: values bound in, rows or a write result out. */
export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  all(): Promise<D1Result>;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<D1Result>;
}

/** The D1-shaped database a CRUD app is given. */
export interface D1Like {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<D1Result[]>;
}
