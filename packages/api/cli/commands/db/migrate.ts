/**
 * @file `light db:migrate`: bring `.data/api.db` (or `--file`) to the schemas
 * of the app's server models, and print every statement; `--dry-run` prints
 * the plan and changes nothing. `--remote` reads and migrates the app's D1
 * database over `@lightstart/cloudflare` instead of a local file, loaded only
 * when the project declares that package. A server model is one whose store's
 * adapter is `api`, found by reading `src/app` and `src/models` the way the
 * generation does. Function adapters are called with the app's arguments when
 * they can be; models the app does not reach through a literal or resolvable
 * `api` store are not migrated.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "@lightstart/cli";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { serverModels } from "../../../node/models.ts";
import { existingIndexes, existingTables, migrateLocal, planMigration } from "../../../node/migrate.ts";

const SECTIONS = ["dependencies", "devDependencies", "peerDependencies"];

/** Whether the project's `package.json` names `packageName` in a dependency list. */
const projectDeclares = (project: string, packageName: string): boolean => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(project, "package.json"), "utf8"));
  } catch {
    return false;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const pkg = parsed as Record<string, unknown>;
  for (const section of SECTIONS) {
    const deps = pkg[section];
    if (deps === null || typeof deps !== "object" || Array.isArray(deps)) continue;
    if (Object.prototype.hasOwnProperty.call(deps, packageName)) return true;
  }
  return false;
};

/** The `light db:migrate` command. */
export default defineCommand({
  description: "Migrate the app's API database to its server models",
  usage: "light db:migrate [--file <.data/api.db>] [--remote] [--dry-run]",
  args: {
    file: { description: "The SQLite file to migrate (default: .data/api.db)" },
    remote: { flag: true, description: "Migrate the app's D1 database over @lightstart/cloudflare" },
    "dry-run": { flag: true, description: "Print the statements and change nothing" },
  },
  async run(ctx, args) {
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
      let statements: string[];
      if (args.remote === true) {
        if (!projectDeclares(ctx.projectDir, "@lightstart/cloudflare")) {
          throw new Error("light db:migrate --remote needs @lightstart/cloudflare in the project (pnpm add @lightstart/cloudflare)");
        }
        const d1 = await import("@lightstart/cloudflare/node/d1.ts").catch(() => {
          throw new Error("light db:migrate --remote could not load @lightstart/cloudflare; add it to the project (pnpm add @lightstart/cloudflare)");
        });
        const { cloudflareApi } = await import("@lightstart/cloudflare/node/cloudflare-api.ts");
        const settings = await d1.d1Settings(ctx.projectDir);
        const api = cloudflareApi({ accountId: settings.accountId, apiToken: settings.apiToken });
        const uuid = await d1.databaseOf(api, settings.database);
        if (uuid === null) throw new Error(`The D1 database ${settings.database} does not exist yet: run light cf:d1:setup`);
        statements = await d1.migrateRemote(api, uuid, models, { dryRun: args["dry-run"] === true });
      } else {
        const file = typeof args.file === "string" && args.file !== "" ? args.file : join(ctx.projectDir, ".data", "api.db");
        statements = args["dry-run"] === true ? planMigration(existingTables(file, models), models, existingIndexes(file)) : migrateLocal(file, models);
      }
      for (const sql of statements) ctx.log.log(sql);
      if (statements.length === 0) ctx.log.log("Nothing to migrate.");
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
});
