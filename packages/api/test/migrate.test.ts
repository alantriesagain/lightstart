// node-only
/**
 * @file The migration planner and the local run: a missing table with its
 * indexes, a live table gaining only the column it lacks, an up-to-date
 * database planning nothing, and a temp file migrated twice.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { done, eqn, ok } from "@lightstart/test/assert.ts";
import { migrateLocal, planMigration } from "../node/migrate.ts";

const models = {
  todo: {
    title: { $type: "string", required: true, index: true },
    done: { $type: "boolean", defaultValue: false },
  },
} as unknown as Record<string, ModelSchema>;

const has = (statements: string[], needle: string): boolean => statements.some((sql) => sql.includes(needle));

const main = async (): Promise<void> => {
  const created = planMigration({}, models);
  ok("from nothing it creates the table", has(created, "CREATE TABLE IF NOT EXISTS todo"));
  ok("from nothing it creates the index", has(created, "CREATE INDEX IF NOT EXISTS idx_todo_title"));

  const missing = planMigration({ todo: ["id", "title", "created", "updated"] }, models, ["idx_todo_title"]);
  eqn("a table missing a column gets one statement", missing.length, 1);
  ok("the statement adds only the missing column", has(missing, "ADD COLUMN done") && !has(missing, "ADD COLUMN title"));

  const current = planMigration({ todo: ["id", "title", "done", "created", "updated"] }, models, ["idx_todo_title"]);
  eqn("an up-to-date database plans nothing", current.length, 0);

  const unindexed = planMigration({ todo: ["id", "title", "done", "created", "updated"] }, models, []);
  ok("an index a live table lacks is created", unindexed.length === 1 && has(unindexed, "CREATE INDEX IF NOT EXISTS idx_todo_title"));

  const dir = mkdtempSync(join(tmpdir(), "light-api-"));
  try {
    const file = join(dir, "nested", "api.db");
    const first = migrateLocal(file, models);
    ok("migrateLocal creates the folder and the tables", first.length > 0 && has(first, "CREATE TABLE IF NOT EXISTS todo"));
    const second = migrateLocal(file, models);
    eqn("a second run plans nothing", second.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  done();
};

await main();
