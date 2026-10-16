/**
 * @bootstrapp/light/model/jsonl: a storage adapter over JSON Lines files, one
 * file per model (`<dir>/<model>.jsonl`). A file is the log of its model's
 * writes: every write appends the row as one line, a later line for an id
 * replaces an earlier one, and a removal appends `{"id":…,"$removed":true}`.
 * A model's file is read into memory the first time the model is reached, so
 * reads answer from memory, and a line an interrupted append cut short is
 * skipped. When the lines a file no longer needs outnumber its rows, the file
 * is rewritten with the rows alone. The adapter reaches its files through
 * `io` (`read`, `append`, `write`), so it runs wherever its host can read and
 * append a file; one process owns a directory. Importing it registers
 * nothing: `registerStorageAdapter("jsonl", JsonlAdapter)` where the store is
 * built, then `createAdapter("jsonl", { name, dir, io })`.
 */

import { buildQueryResult, validateQueryOptions } from "./query-builder.js";

/** @import { JsonlStorage, JsonlTable, Row, StorageAdapter } from "./types.ts" */

const COMPACT_AFTER = 32;

/**
 * A file's text as rows, with how many of its lines no longer hold one and
 * whether every line read whole.
 * @param {string} text
 * @returns {{ rows: Map<string, Row>, stale: number, clean: boolean }}
 */
const readLines = (text) => {
  /** @type {Map<string, Row>} */
  const rows = new Map();
  let lines = 0;
  let clean = text === "" || text.endsWith("\n");
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    /** @type {Row | null} */
    let entry = null;
    try {
      entry = /** @type {Row | null} */ (JSON.parse(line));
    } catch {
      clean = false;
      continue;
    }
    if (entry === null || typeof entry !== "object" || entry.id === undefined || entry.id === null) {
      clean = false;
      continue;
    }
    lines++;
    const key = String(entry.id);
    if (entry.$removed === true) rows.delete(key);
    else rows.set(key, entry);
  }
  return { rows, stale: lines - rows.size, clean };
};

/** @param {Map<string, Row>} rows */
const linesOf = (rows) => [...rows.values()].map((row) => `${JSON.stringify(row)}\n`).join("");

/** @param {JsonlStorage} adapter @param {JsonlTable} table */
const compact = (adapter, table) => {
  adapter.io.write(table.path, linesOf(table.rows));
  table.stale = 0;
};

/** @param {JsonlStorage} adapter @param {JsonlTable} table */
const settle = (adapter, table) => {
  if (table.stale > COMPACT_AFTER && table.stale > table.rows.size) compact(adapter, table);
};

/**
 * @param {JsonlStorage} adapter
 * @param {string} model
 * @returns {JsonlTable}
 */
const tableOf = (adapter, model) => {
  let table = adapter.tables.get(model);
  if (!table) {
    const path = `${adapter.dir}/${model}.jsonl`;
    const { rows, stale, clean } = readLines(adapter.io.read(path) ?? "");
    table = { path, rows, stale };
    adapter.tables.set(model, table);
    if (!clean) compact(adapter, table);
    else settle(adapter, table);
  }
  return table;
};

/** @param {Row} row @returns {Row} */
const copy = (row) => Object.fromEntries(Object.entries(row));

/**
 * Append one row and hold it as a reload would read it back.
 * @param {JsonlStorage} adapter
 * @param {JsonlTable} table
 * @param {Row} row
 * @returns {Row}
 */
const record = (adapter, table, row) => {
  const line = JSON.stringify(row);
  const stored = /** @type {Row} */ (JSON.parse(line));
  const key = String(stored.id);
  if (table.rows.has(key)) table.stale++;
  table.rows.set(key, stored);
  adapter.io.append(table.path, `${line}\n`);
  return stored;
};

/**
 * @param {JsonlTable} table
 * @param {string} model
 * @param {Row} row
 */
const assertNew = (table, model, row) => {
  if (row.id === undefined || row.id === null) throw new Error(`Model "${model}": a row needs an id to be stored in a JSONL file`);
  if (table.rows.has(String(row.id))) throw new Error(`Model "${model}": a row with id "${String(row.id)}" exists`);
};

/** @type {StorageAdapter & ThisType<JsonlStorage>} */
const JsonlAdapter = {
  async init() {
    this.tables = new Map();
  },

  async get(model, id) {
    const row = tableOf(this, model).rows.get(String(id));
    return row ? copy(row) : null;
  },

  async query(model, options = {}) {
    validateQueryOptions(options);
    const result = buildQueryResult([...tableOf(this, model).rows.values()], options);
    return { rows: result.items.map(copy), total: result.total };
  },

  async insert(model, row) {
    const table = tableOf(this, model);
    assertNew(table, model, row);
    const stored = record(this, table, row);
    return copy(stored);
  },

  async insertMany(model, rows) {
    const table = tableOf(this, model);
    for (const row of rows) assertNew(table, model, row);
    return rows.map((row) => copy(record(this, table, row)));
  },

  async update(model, row) {
    const table = tableOf(this, model);
    const stored = record(this, table, row);
    settle(this, table);
    return copy(stored);
  },

  async delete(model, id) {
    const table = tableOf(this, model);
    const key = String(id);
    if (!table.rows.has(key)) return false;
    table.rows.delete(key);
    this.io.append(table.path, `${JSON.stringify({ id, $removed: true })}\n`);
    table.stale += 2;
    settle(this, table);
    return true;
  },

  async count(model, where) {
    const { rows } = tableOf(this, model);
    if (!where || Object.keys(where).length === 0) return rows.size;
    return buildQueryResult([...rows.values()], { where }).total;
  },

  async exists(model, where) {
    return (await this.count(model, where)) > 0;
  },

  async truncate(model) {
    const table = tableOf(this, model);
    table.rows.clear();
    compact(this, table);
  },

  async close() {
    this.tables = new Map();
  },
};

export default JsonlAdapter;
