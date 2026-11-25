/**
 * @file The server contributions a project's dependencies declare: each
 * dependency whose `package.json` says `"light": { "server": "<module>" }`,
 * sorted by package name, with the specifier the server entry imports and the
 * models a migration creates.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { dependencyNames, packageJsonOf } from "@lightstart/app/node/generate.ts";

/** One declared contribution: the package, the specifier its module is imported by, and the file it resolves to. */
export interface ContributionEntry {
  package: string;
  specifier: string;
  file: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Every dependency declaring `light.server`, sorted by package name. */
export const contributionEntries = (project: string): ContributionEntry[] => {
  const require = createRequire(join(project, "package.json"));
  const entries: ContributionEntry[] = [];
  for (const name of dependencyNames(project)) {
    const path = packageJsonOf(require, name);
    if (path === null) continue;
    const pkg: unknown = JSON.parse(readFileSync(path, "utf8"));
    const light = isRecord(pkg) ? pkg["light"] : undefined;
    const module = isRecord(light) ? light["server"] : undefined;
    if (typeof module !== "string" || module === "") continue;
    const relativeModule = module.replace(/^\.\//, "");
    entries.push({ package: name, specifier: `${name}/${relativeModule}`, file: join(path, "..", relativeModule) });
  }
  return entries;
};

/** The models every declared contribution adds, merged in package order. */
export const contributedModels = async (project: string): Promise<Record<string, ModelSchema>> => {
  const models: Record<string, ModelSchema> = {};
  for (const entry of contributionEntries(project)) {
    const loaded: unknown = (await import(pathToFileURL(entry.file).href) as { default?: unknown }).default;
    const own = isRecord(loaded) ? loaded["models"] : undefined;
    if (!isRecord(own)) continue;
    for (const [name, schema] of Object.entries(own)) if (isRecord(schema)) models[name] = schema as ModelSchema;
  }
  return models;
};
