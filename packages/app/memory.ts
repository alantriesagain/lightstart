/**
 * @file An in-memory storage adapter, for tests and for a host that wants an
 * app's rows to last no longer than its process. Every read is matched, ordered
 * and paged by the same helpers a local adapter uses. It is a definition object,
 * as light's JSONL adapter is: `createAdapter` makes each store's instance from
 * it, which scriptc compiles where a class instance would not.
 */

import { buildQueryResult } from "@lightstart/light/model/adapter";
import type { QueryOptions, QueryPage, Row, StorageAdapter, WhereClause } from "@lightstart/light/model/types.ts";

/** A memory store's instance: the adapter's fields with its rows, one list per model. */
export type MemoryStorage = StorageAdapter & { tables: Map<string, Row[]> };

const isId = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";

const copy = (row: Row): Row => ({ ...row });

const rowsOf = (adapter: MemoryStorage, model: string): Row[] => {
  const known = adapter.tables.get(model);
  if (known !== undefined) return known;
  const created: Row[] = [];
  adapter.tables.set(model, created);
  return created;
};

/** The memory adapter's definition, registered as `memory`. */
export const MemoryAdapter: StorageAdapter = {
  async init(this: MemoryStorage): Promise<void> {
    this.tables = new Map();
  },

  async get(this: MemoryStorage, model: string, id: string | number): Promise<Row | null> {
    const row = rowsOf(this, model).find((entry) => entry.id === id);
    return row === undefined ? null : copy(row);
  },

  async query(this: MemoryStorage, model: string, given: QueryOptions | undefined): Promise<QueryPage> {
    const options: QueryOptions = given === undefined ? {} : given;
    const result = buildQueryResult(rowsOf(this, model), options);
    return { rows: result.items.map(copy), total: result.total };
  },

  async insert(this: MemoryStorage, model: string, row: Row): Promise<Row> {
    const stored = copy(row);
    rowsOf(this, model).push(stored);
    return copy(stored);
  },

  async insertMany(this: MemoryStorage, model: string, rows: Row[]): Promise<Row[]> {
    const table = rowsOf(this, model);
    const out: Row[] = [];
    for (const row of rows) {
      const stored = copy(row);
      table.push(stored);
      out.push(copy(stored));
    }
    return out;
  },

  async update(this: MemoryStorage, model: string, row: Row): Promise<Row> {
    if (!isId(row.id)) throw new Error(`Model "${model}": a row needs an id to update`);
    const rows = rowsOf(this, model);
    const at = rows.findIndex((entry) => entry.id === row.id);
    if (at < 0) throw new Error(`Model "${model}": no row "${String(row.id)}"`);
    rows[at] = copy(row);
    return copy(row);
  },

  async delete(this: MemoryStorage, model: string, id: string | number): Promise<boolean> {
    const rows = rowsOf(this, model);
    const at = rows.findIndex((entry) => entry.id === id);
    if (at < 0) return false;
    rows.splice(at, 1);
    return true;
  },

  async count(this: MemoryStorage, model: string, where: WhereClause | undefined): Promise<number> {
    return buildQueryResult(rowsOf(this, model), { where }).total;
  },

  async close(this: MemoryStorage): Promise<void> {
    this.tables = new Map();
  },
};
