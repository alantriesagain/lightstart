/**
 * @file `light db:migrate`: bring `.data/api.db` (or `--file`) to the schemas
 * of the app's server models, and print every statement; `--dry-run` prints
 * the plan and changes nothing. A server model is one whose store's adapter is
 * `api`, found by reading `src/app` and `src/models` the way the generation
 * does. Function adapters are called with the app's arguments when they can be;
 * models the app does not reach through a literal or resolvable `api` store are
 * not migrated.
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { appOf } from "@lightstart/app/node/generate.ts";
import { defineCommand } from "@lightstart/cli";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { existingIndexes, existingTables, migrateLocal, planMigration } from "../../../node/migrate.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const modelFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".js"))
    .filter((name) => !name.endsWith(".d.ts") && !name.includes(".test."))
    .sort()
    .map((name) => join(dir, name));
};

const apiStoresOf = async (project: string): Promise<Set<string>> => {
  const found = appOf(project);
  const stores = new Set<string>();
  if (found === null) return stores;
  const module: unknown = await import(`${pathToFileURL(found.path).href}?mtime=${String(Date.now())}`);
  const config = isRecord(module) ? module["default"] : undefined;
  const declared = isRecord(config) ? config["stores"] : undefined;
  if (!isRecord(declared)) return stores;
  for (const [store, value] of Object.entries(declared)) {
    if (!isRecord(value)) continue;
    const adapter = value["adapter"];
    let name: unknown = adapter;
    if (typeof adapter === "function") {
      try {
        name = (adapter as (args: unknown) => unknown)(isRecord(config) ? config["args"] : undefined);
      } catch {
        name = undefined;
      }
    }
    if (name === "api") stores.add(store);
  }
  return stores;
};

const schemaOf = (value: unknown): ModelSchema | null => {
  if (!isRecord(value)) return null;
  const schema = isRecord(value["schema"]) ? value["schema"] : isRecord(value["$schema"]) ? value["$schema"] : null;
  return schema === null ? null : (schema as ModelSchema);
};

const serverModels = async (project: string): Promise<Record<string, ModelSchema>> => {
  const apiStores = await apiStoresOf(project);
  const models: Record<string, ModelSchema> = {};
  if (apiStores.size === 0) return models;
  for (const file of modelFiles(join(project, "src", "models"))) {
    const module: unknown = await import(`${pathToFileURL(file).href}?mtime=${String(Date.now())}`);
    const schema = schemaOf(isRecord(module) ? module["default"] : undefined);
    if (schema === null) continue;
    const store = typeof schema.$store === "string" ? schema.$store : "main";
    if (!apiStores.has(store)) continue;
    models[basename(file).replace(/\.(ts|js)$/, "")] = schema;
  }
  return models;
};

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
