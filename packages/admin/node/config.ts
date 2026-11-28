/**
 * @file Read a project's `src/admin.ts` or `.js` without its views: the title
 * and the folders the file API may touch. A project with no file, or an empty
 * list, allows nothing.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AdminConfig } from "../index.ts";
import { pathProblem } from "../paths.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The project's `src/admin.ts` or `.js`; null when it has none, an error naming both when it has both. */
export const adminPathOf = (project: string): string | null => {
  const ts = join(project, "src", "admin.ts");
  const js = join(project, "src", "admin.js");
  const hasTs = existsSync(ts);
  const hasJs = existsSync(js);
  if (hasTs && hasJs) throw new Error("The app has both src/admin.ts and src/admin.js; keep one of them");
  if (hasTs) return ts;
  if (hasJs) return js;
  return null;
};

/** Check every folder the config names, returning them deduplicated in order; a bad one is an error naming it. */
export const validateFolders = (folders: readonly unknown[]): string[] => {
  const out: string[] = [];
  for (const folder of folders) {
    if (typeof folder !== "string") throw new Error("An admin folder is a string");
    const problem = pathProblem(folder);
    if (problem !== null) throw new Error(`The admin folder "${folder}" is not allowed: ${problem}`);
    if (!out.includes(folder)) out.push(folder);
  }
  return out;
};

const configOf = (value: unknown, from: string): AdminConfig => {
  if (!isRecord(value)) throw new Error(`${from} default-exports no admin config; use defineAdmin({ folders })`);
  const folders = value["folders"];
  if (!Array.isArray(folders)) throw new Error(`${from} declares no folders array; use defineAdmin({ folders })`);
  const config: AdminConfig = { folders: validateFolders(folders) };
  if (typeof value["title"] === "string" && value["title"].trim() !== "") config.title = value["title"];
  return config;
};

/** The config `src/admin` default-exports; null when the project has no file. An import that throws is the caller's error. */
export const readAdmin = async (project: string): Promise<AdminConfig | null> => {
  const path = adminPathOf(project);
  if (path === null) return null;
  const module = (await import(`${pathToFileURL(path).href}?mtime=${String(Date.now())}`)) as { default?: unknown };
  return configOf(module.default, path);
};

/** The title the admin uses: the config's, else "Admin". */
export const adminTitleOf = (config: AdminConfig | null): string => (config?.title ?? "Admin");

/** The folders the admin may touch: the config's, else none. */
export const adminFoldersOf = (config: AdminConfig | null): string[] => (config === null ? [] : [...config.folders]);
