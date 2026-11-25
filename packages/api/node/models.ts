/**
 * @file Finding an app's server models: the models in `src/models` whose
 * `$store` names a store whose adapter is `api`. The discovery reads
 * `src/app` the way the generation does, so a store named by a literal or a
 * function adapter the app's arguments can run is found the same way
 * `light db:migrate` and the generated server entry find it.
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { appOf } from "@lightstart/app/node/generate.ts";

import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { contributedModels } from "./contributions.ts";

/** One server model: its name, the file it lives in, and its schema. */
export interface ServerModelEntry {
  name: string;
  file: string;
  schema: ModelSchema;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The `src/models` files of a project, sorted, tests and declarations left out. */
export const modelFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".js"))
    .filter((name) => !name.endsWith(".d.ts") && !name.includes(".test."))
    .sort()
    .map((name) => join(dir, name));
};

/** The names of the stores whose adapter is `api`, read from the app's `src/app`. */
export const apiStoresOf = async (project: string): Promise<Set<string>> => {
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

/** A model module's default export's schema, or null when it carries none. */
export const schemaOf = (value: unknown): ModelSchema | null => {
  if (!isRecord(value)) return null;
  const schema = isRecord(value["schema"]) ? value["schema"] : isRecord(value["$schema"]) ? value["$schema"] : null;
  return schema === null ? null : (schema as ModelSchema);
};

/** Every server model of the project, sorted by file name. */
export const serverModelEntries = async (project: string): Promise<ServerModelEntry[]> => {
  const apiStores = await apiStoresOf(project);
  if (apiStores.size === 0) return [];
  const entries: ServerModelEntry[] = [];
  for (const file of modelFiles(join(project, "src", "models"))) {
    const module: unknown = await import(`${pathToFileURL(file).href}?mtime=${String(Date.now())}`);
    const schema = schemaOf(isRecord(module) ? module["default"] : undefined);
    if (schema === null) continue;
    const store = typeof schema.$store === "string" ? schema.$store : "main";
    if (!apiStores.has(store)) continue;
    entries.push({ name: basename(file).replace(/\.(ts|js)$/, ""), file, schema });
  }
  return entries;
};

/** The server models of the project, by table name: what its dependencies contribute, then its own, its own winning a name. */
export const serverModels = async (project: string): Promise<Record<string, ModelSchema>> => {
  const models: Record<string, ModelSchema> = await contributedModels(project);
  for (const entry of await serverModelEntries(project)) models[entry.name] = entry.schema;
  return models;
};
