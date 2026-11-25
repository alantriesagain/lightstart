/**
 * @file `light db:migrate`: bring `.data/api.db` (or `--file`) to the schemas
 * of the app's server models, and print every statement; `--dry-run` prints
 * the plan and changes nothing. A server model is one whose store's adapter is
 * `api`, found by reading `src/app` and `src/models` the way the generation
 * does. Function adapters are called with the app's arguments when they can be;
 * models the app does not reach through a literal or resolvable `api` store are
 * not migrated.
 */

import { join } from "node:path";
import { defineCommand } from "@lightstart/cli";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { serverModels } from "../../../node/models.ts";
import { existingIndexes, existingTables, migrateLocal, planMigration } from "../../../node/migrate.ts";

/** The `light db:migrate` command. */
export default defineCommand({
  description: "Migrate the app's local API database to its server models",
  usage: "light db:migrate [--file <.data/api.db>] [--dry-run]",
  args: {
    file: { description: "The SQLite file to migrate (default: .data/api.db)" },
    "dry-run": { flag: true, description: "Print the statements and change nothing" },
  },
  async run(ctx, args) {
    const file = typeof args.file === "string" && args.file !== "" ? args.file : join(ctx.projectDir, ".data", "api.db");
    let models: Record<string, ModelSchema>;
    try {
      models = await serverModels(ctx.projectDir);
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
    if (Object.keys(models).length === 0) {
      ctx.log.log("No server models use the api adapter.");
      return 0;
    }
    try {
      const statements = args["dry-run"] === true ? planMigration(existingTables(file, models), models, existingIndexes(file)) : migrateLocal(file, models);
      for (const sql of statements) ctx.log.log(sql);
      if (statements.length === 0) ctx.log.log("Nothing to migrate.");
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
