/**
 * @file An in-memory storage adapter, for tests and for a host that wants an
 * app's rows to last no longer than its process. Every read is matched, ordered
 * and paged by the same helpers a local adapter uses.
 */

import { buildQueryResult } from "@lightstart/light/model/adapter";
import type { QueryOptions, QueryPage, Row, StorageAdapter, WhereClause } from "@lightstart/light/model/types.ts";

const isId = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

/** The rows of an app in records, one list per model. */
export class MemoryAdapter implements StorageAdapter {
  [extra: string]: unknown;
  type = "memory";
  tables: Record<string, Row[]> = {};

  async init(): Promise<void> {
    this.tables = {};
  }

  async get(model: string, id: string | number): Promise<Row | null> {
    const row = this.rows(model).find((entry) => entry.id === id);
    return row === undefined ? null : { ...row };
  }

  async query(model: string, opts: QueryOptions): Promise<QueryPage> {
    const result = buildQueryResult(this.rows(model), opts);
    return { rows: result.items.map((row) => ({ ...row })), total: result.total };
  }

  async insert(model: string, row: Row): Promise<Row> {
    const stored = { ...row };
    this.rows(model).push(stored);
    return { ...stored };
  }

  async insertMany(model: string, rows: Row[]): Promise<Row[]> {
    const out: Row[] = [];
    for (const row of rows) out.push(await this.insert(model, row));
    return out;
  }

  async update(model: string, row: Row): Promise<Row> {
    if (!isId(row.id)) throw new Error(`Model "${model}": a row needs an id to update`);
    const rows = this.rows(model);
    const at = rows.findIndex((entry) => entry.id === row.id);
    if (at < 0) throw new Error(`Model "${model}": no row "${String(row.id)}"`);
    rows[at] = { ...row };
    return { ...row };
  }

  async delete(model: string, id: string | number): Promise<boolean> {
    const rows = this.rows(model);
    const at = rows.findIndex((entry) => entry.id === id);
    if (at < 0) return false;
    rows.splice(at, 1);
    return true;
  }

  async count(model: string, where?: WhereClause): Promise<number> {
    return buildQueryResult(this.rows(model), { where }).total;
  }

  async close(): Promise<void> {
    this.tables = {};
  }

  private rows(model: string): Row[] {
    const known = this.tables[model];
    if (known !== undefined) return known;
    const created: Row[] = [];
    this.tables[model] = created;
    return created;
  }
}
