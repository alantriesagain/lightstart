/**
 * @file Local database migrations for an app's server models. `planMigration`
 * is pure: from the columns each existing table holds it answers the
 * statements that bring those tables to the models. `migrateLocal` opens the
 * node SQLite file, reads its columns and index names and runs that plan in
 * one transaction. An index the database does not have is created, on a new
 * table or a live one.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { buildAddColumnSQL, buildCreateIndexSQL, buildCreateTableSQL, tableColumns } from "@lightstart/light/model/sql-builder.ts";
import { Database } from "@lightstart/sqlite/node";
import type { SqlDatabase } from "@lightstart/sqlite";

const tableNames = (db: SqlDatabase): Set<string> =>
  new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => String(row["name"])));

const indexNamesOf = (db: SqlDatabase): string[] =>
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => String(row["name"]));

const indexName = (statement: string): string | null => {
  const match = /INDEX IF NOT EXISTS (?:"((?:[^"]|"")+)"|([^\s(]+))/.exec(statement);
  if (match === null) return null;
  return match[1] !== undefined ? match[1].replace(/""/g, '"') : (match[2] ?? null);
};

const columnsOf = (db: SqlDatabase, models: Record<string, ModelSchema>): Record<string, string[]> => {
  const tables = tableNames(db);
  const existing: Record<string, string[]> = {};
  for (const model of Object.keys(models)) {
    if (model.startsWith("$") || !tables.has(model)) continue;
    existing[model] = tableColumns(db, model);
  }
  return existing;
};

/**
 * The statements that bring `existing` (each table's columns; an absent key
 * means no table) and `indexes` (the index names the database has) to
 * `models`: a `CREATE TABLE` for a missing table, the missing `ALTER TABLE ADD
 * COLUMN`s for a live one, then every index not in `indexes`; nothing for a
 * database already at its schemas.
 */
export const planMigration = (existing: Record<string, string[]>, models: Record<string, ModelSchema>, indexes: readonly string[] = []): string[] => {
  const have = new Set(indexes);
  const statements: string[] = [];
  for (const [model, schema] of Object.entries(models)) {
    if (model.startsWith("$")) continue;
    const columns = existing[model];
    if (columns === undefined) statements.push(buildCreateTableSQL(model, schema));
    else statements.push(...buildAddColumnSQL(model, schema, columns));
    for (const index of buildCreateIndexSQL(model, schema)) {
      const name = indexName(index);
      if (name === null || !have.has(name)) statements.push(index);
    }
  }
  return statements;
};

/** The columns each of `models`' tables has in `file`; an absent key means no table, and a missing file has none. */
export const existingTables = (file: string, models: Record<string, ModelSchema>): Record<string, string[]> => {
  if (!existsSync(file)) return {};
  const db = Database.open(file, { readOnly: true });
  try {
    return columnsOf(db, models);
  } finally {
    db.close();
  }
};

/** The index names `file` has; a missing file has none. */
export const existingIndexes = (file: string): string[] => {
  if (!existsSync(file)) return [];
  const db = Database.open(file, { readOnly: true });
  try {
    return indexNamesOf(db);
  } finally {
    db.close();
  }
};

/** Open `file` (making its folder), run the plan in one transaction, and answer the statements run. */
export const migrateLocal = (file: string, models: Record<string, ModelSchema>): string[] => {
  mkdirSync(dirname(file), { recursive: true });
  const db = Database.open(file);
  try {
    const statements = planMigration(columnsOf(db, models), models, indexNamesOf(db));
    if (statements.length > 0) {
      db.transaction(() => {
        for (const sql of statements) db.exec(sql);
        return 0;
      });
    }
    return statements;
  } finally {
    db.close();
  }
};
