/**
 * @lightstart/sqlite/d1: a binding shaped like Cloudflare D1's over an open
 * database of either driver. `prepare(sql).bind(...values)` answers a
 * statement whose `first`, `raw`, `all` and `run` are promises, and `batch`
 * runs its statements in one transaction, as D1 does. Code written against D1
 * (a Pages Function's core) then runs on a local file, or on the very
 * connection a self-hosted server writes, its statements cached by the driver.
 *
 * D1 refuses explicit SQL transactions and bounds a statement to 100 KB and a
 * query to 100 bound parameters. Its `d1Of(db, { strict: true })` refuses the
 * same, with D1-like errors; the default is permissive, as the drivers are.
 */

import type { SqlDatabase } from "./index.ts";

/** D1's documented maximum SQL statement length, in bytes. */
export const D1_MAX_SQL_BYTES = 100_000;

/** D1's documented maximum bound parameters per query. */
export const D1_MAX_BOUND_PARAMETERS = 100;

/** The metadata D1 puts on a result. `rows_read` and `rows_written` are left out here. */
export interface D1Meta {
  changes: number;
  last_row_id: number;
  duration: number;
  changed_db: boolean;
}

/** What `run` answers, as D1 shapes it. */
export interface D1RunResult {
  success: boolean;
  meta: D1Meta;
}

/** What `all` answers, as D1 shapes it. */
export interface D1AllResult {
  results: Record<string, unknown>[];
  success: boolean;
  meta: D1Meta;
}

/** What `exec` answers, as D1 shapes it. */
export interface D1ExecResult {
  count: number;
  duration: number;
}

/** How `raw` shapes its rows. */
export interface D1RawOptions {
  columnNames?: boolean;
}

/** How `d1Of` shapes the binding. */
export interface D1Options {
  /** Refuse what Cloudflare D1 refuses: explicit transactions, long SQL, too many parameters. */
  strict?: boolean;
}

const transactionWords = ["BEGIN", "COMMIT", "END", "ROLLBACK", "SAVEPOINT", "RELEASE"];

const isSpace = (char: string): boolean => char === " " || char === "\t" || char === "\n" || char === "\r" || char === "\f";

const isLetter = (char: string): boolean => (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");

/** The bytes a string takes as UTF-8, without needing a TextEncoder in scriptc. */
const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
};

/**
 * Split SQL at semicolons outside quotes and comments; a statement keeps its text. A
 * `CREATE [TEMP] TRIGGER` body's semicolons stay inside it until its own `END` (a `CASE … END`
 * within counted), so a trigger is one statement.
 */
const splitStatements = (sql: string): string[] => {
  const statements: string[] = [];
  let start = 0;
  let quote = "";
  let index = 0;
  let words = 0;
  let lead = "";
  let trigger = false;
  let body = false;
  let cases = 0;
  while (index < sql.length) {
    const char = sql[index]!;
    if (quote !== "") {
      if (quote === "]") {
        if (char === "]") quote = "";
      } else if (char === quote) {
        if (index + 1 < sql.length && sql[index + 1] === quote) index += 1;
        else quote = "";
      }
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      index += 1;
      continue;
    }
    if (char === "[") {
      quote = "]";
      index += 1;
      continue;
    }
    if (char === "-" && sql[index + 1] === "-") {
      index += 2;
      while (index < sql.length && sql[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && sql[index + 1] === "*") {
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) index += 1;
      index += 2;
      continue;
    }
    if (isLetter(char)) {
      const from = index;
      while (index < sql.length && (isLetter(sql[index]!) || sql[index] === "_" || (sql[index]! >= "0" && sql[index]! <= "9"))) index += 1;
      const word = sql.slice(from, index).toUpperCase();
      words += 1;
      if (words === 1) lead = word;
      else if (lead === "CREATE" && words <= 3 && word === "TRIGGER") trigger = true;
      else if (trigger && !body && word === "BEGIN") body = true;
      else if (body && word === "CASE") cases += 1;
      else if (body && word === "END") {
        if (cases > 0) cases -= 1;
        else body = false;
      }
      continue;
    }
    if (char === ";" && !body) {
      statements.push(sql.slice(start, index));
      start = index + 1;
      words = 0;
      lead = "";
      trigger = false;
    }
    index += 1;
  }
  statements.push(sql.slice(start));
  return statements.filter((statement) => statement.trim() !== "");
};

/** The first word of a statement, past whitespace and comments, uppercased. */
const firstKeyword = (statement: string): string => {
  let index = 0;
  for (;;) {
    while (index < statement.length && isSpace(statement[index]!)) index += 1;
    if (index + 1 < statement.length && statement[index] === "-" && statement[index + 1] === "-") {
      index += 2;
      while (index < statement.length && statement[index] !== "\n") index += 1;
      continue;
    }
    if (index + 1 < statement.length && statement[index] === "/" && statement[index + 1] === "*") {
      const end = statement.indexOf("*/", index + 2);
      index = end < 0 ? statement.length : end + 2;
      continue;
    }
    break;
  }
  const start = index;
  while (index < statement.length && isLetter(statement[index]!)) index += 1;
  return statement.slice(start, index).toUpperCase();
};

/** Refuse a statement the way D1 does: too long, or an explicit transaction. */
const validateSql = (sql: string): void => {
  for (const statement of splitStatements(sql)) {
    if (utf8Bytes(statement) > D1_MAX_SQL_BYTES) throw new Error("D1_ERROR: statement too long");
    if (transactionWords.includes(firstKeyword(statement))) throw new Error("D1_ERROR: cannot start a transaction within a transaction");
  }
};

/** Refuse more bindings than D1 allows. */
const validateParams = (params: unknown[]): void => {
  if (params.length > D1_MAX_BOUND_PARAMETERS) throw new Error("D1_ERROR: too many SQL variables");
};

/** One bound statement; `bind` answers a new one, so a prepared statement is reusable. */
export class D1Statement {
  readonly db: SqlDatabase;
  readonly sql: string;
  readonly params: unknown[];
  readonly strict: boolean;

  constructor(db: SqlDatabase, sql: string, params: unknown[], strict = false) {
    if (strict) {
      validateSql(sql);
      validateParams(params);
    }
    this.db = db;
    this.sql = sql;
    this.params = params;
    this.strict = strict;
  }

  bind(...values: unknown[]): D1Statement {
    return new D1Statement(this.db, this.sql, values, this.strict);
  }

  first(): Promise<Record<string, unknown> | null>;
  first(column: string): Promise<unknown>;
  first(column?: string): Promise<Record<string, unknown> | unknown | null> {
    const row = this.db.prepare(this.sql).get(this.params);
    if (row === null) return Promise.resolve(null);
    if (column === undefined) return Promise.resolve(row);
    if (row[column] === undefined) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
    return Promise.resolve(row[column]);
  }

  /** The rows as arrays of values, the column names first when asked. */
  raw(options: D1RawOptions = {}): Promise<unknown[][]> {
    const rows = this.db.prepare(this.sql).all(this.params);
    const out: unknown[][] = [];
    if (options.columnNames === true && rows.length > 0) out.push(Object.keys(rows[0]!));
    for (const row of rows) out.push(Object.keys(row).map((key) => row[key]));
    return Promise.resolve(out);
  }

  all(): Promise<D1AllResult> {
    const started = Date.now();
    const results = this.db.prepare(this.sql).all(this.params);
    return Promise.resolve({
      results,
      success: true,
      meta: { changes: 0, last_row_id: 0, duration: Date.now() - started, changed_db: false },
    });
  }

  run(): Promise<D1RunResult> {
    return Promise.resolve(this.execute());
  }

  /** Run now, synchronously: what `batch` does inside its transaction. */
  execute(): D1RunResult {
    const started = Date.now();
    const out = this.db.prepare(this.sql).run(this.params);
    const changes = Number(out.changes);
    return {
      success: true,
      meta: {
        changes,
        last_row_id: Number(out.lastId),
        duration: Date.now() - started,
        changed_db: changes > 0,
      },
    };
  }
}

/** The D1-shaped binding over `db`. */
export class D1Binding {
  readonly db: SqlDatabase;
  readonly strict: boolean;

  constructor(db: SqlDatabase, options: D1Options = {}) {
    this.db = db;
    this.strict = options.strict === true;
  }

  prepare(sql: string): D1Statement {
    return new D1Statement(this.db, sql, [], this.strict);
  }

  /** Every statement in one transaction: a failure leaves none of them applied. */
  batch(statements: D1Statement[]): Promise<D1RunResult[]> {
    try {
      return Promise.resolve(this.db.transaction(() => statements.map((statement) => {
        if (!(statement instanceof D1Statement) || statement.db !== this.db) throw new Error("batch takes statements prepared by this binding");
        return statement.execute();
      })));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /** Run one or more statements with no parameters, as D1's exec does. */
  exec(sql: string): Promise<D1ExecResult> {
    const statements = splitStatements(sql);
    if (this.strict) {
      validateSql(sql);
      validateParams([]);
    }
    const started = Date.now();
    this.db.exec(sql);
    return Promise.resolve({ count: statements.length, duration: Date.now() - started });
  }
}

/** A D1-shaped binding over an open database. */
export const d1Of = (db: SqlDatabase, options: D1Options = {}): D1Binding => new D1Binding(db, options);
