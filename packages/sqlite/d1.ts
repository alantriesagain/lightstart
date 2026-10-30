/**
 * @lightstart/sqlite/d1: a binding shaped like Cloudflare D1's over an open
 * database of either driver. `prepare(sql).bind(...values)` answers a
 * statement whose `first`, `all` and `run` are promises, and `batch` runs its
 * statements in one transaction, as D1 does. Code written against D1 (a
 * Pages Function's core) then runs on a local file, or on the very
 * connection a self-hosted server writes, its statements cached by the driver.
 */

import type { SqlDatabase } from "./index.ts";

/** What `run` answers, as D1 shapes it. */
export interface D1RunResult {
  success: boolean;
  meta: { changes: number; last_row_id: number };
}

/** One bound statement; `bind` answers a new one, so a prepared statement is reusable. */
export class D1Statement {
  readonly db: SqlDatabase;
  readonly sql: string;
  readonly params: unknown[];

  constructor(db: SqlDatabase, sql: string, params: unknown[]) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): D1Statement {
    return new D1Statement(this.db, this.sql, values);
  }

  first(): Promise<Record<string, unknown> | null> {
    return Promise.resolve(this.db.prepare(this.sql).get(this.params));
  }

  all(): Promise<{ results: Record<string, unknown>[]; success: boolean }> {
    return Promise.resolve({ results: this.db.prepare(this.sql).all(this.params), success: true });
  }

  run(): Promise<D1RunResult> {
    return Promise.resolve(this.execute());
  }

  /** Run now, synchronously: what `batch` does inside its transaction. */
  execute(): D1RunResult {
    const out = this.db.prepare(this.sql).run(this.params);
    return { success: true, meta: { changes: out.changes, last_row_id: Number(out.lastId) } };
  }
}

/** The D1-shaped binding over `db`. */
export class D1Binding {
  readonly db: SqlDatabase;

  constructor(db: SqlDatabase) {
    this.db = db;
  }

  prepare(sql: string): D1Statement {
    return new D1Statement(this.db, sql, []);
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

  exec(sql: string): Promise<void> {
    this.db.exec(sql);
    return Promise.resolve();
  }
}

/** A D1-shaped binding over an open database. */
export const d1Of = (db: SqlDatabase): D1Binding => new D1Binding(db);
