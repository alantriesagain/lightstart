/**
 * @file Read a project's `src/pwa.ts` or `.js` and `src/app.ts` or `.js` the
 * way the app generator reads them: without their views, and with an error
 * naming both files when a project has both languages.
 */

import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeBase } from "../base.ts";
import type { PwaConfig } from "../index.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const sourcePathOf = (project: string, name: string): string | null => {
  const ts = join(project, "src", `${name}.ts`);
  const js = join(project, "src", `${name}.js`);
  const hasTs = existsSync(ts);
  const hasJs = existsSync(js);
  if (hasTs && hasJs) throw new Error(`The app has both src/${name}.ts and src/${name}.js; keep one of them`);
  if (hasTs) return ts;
  if (hasJs) return js;
  return null;
};

/** The project's `src/pwa.ts` or `.js`; null when it has none, an error naming both when it has both. */
export const pwaPathOf = (project: string): string | null => sourcePathOf(project, "pwa");

/** The project's `src/app.ts` or `.js`; null when it has none, an error naming both when it has both. */
export const appPathOf = (project: string): string | null => sourcePathOf(project, "app");

const load = async (path: string): Promise<unknown> => (await import(`${pathToFileURL(path).href}?mtime=${String(Date.now())}`) as { default?: unknown }).default;

/** The config `src/pwa` default-exports, or null when the project has no `src/pwa`; an import that throws is the caller's error. */
export const readPwa = async (project: string): Promise<PwaConfig | null> => {
  const path = pwaPathOf(project);
  if (path === null) return null;
  const config = await load(path);
  if (!isRecord(config)) throw new Error(`${path} default-exports no PWA config; use definePwa({ ... })`);
  return config as PwaConfig;
};

/** The app fields the manifest defaults to: its name, its title and its deploy base. */
export interface AppIdentity {
  name: string;
  title?: string;
  base: string;
}

const baseOf = (config: Record<string, unknown>): string => {
  if (typeof config["base"] === "string") return normalizeBase(config["base"]);
  if (typeof config["url"] === "string") {
    try {
      return normalizeBase(new URL(config["url"]).pathname);
    } catch {
      return "";
    }
  }
  return "";
};

/** Read `src/app` for the manifest's defaults; the folder's name when the project has no app module. */
export const appIdentityOf = async (project: string): Promise<AppIdentity> => {
  const path = appPathOf(project);
  if (path === null) return { name: basename(project), base: "" };
  const config = await load(path);
  if (!isRecord(config)) return { name: basename(project), base: "" };
  const name = typeof config["name"] === "string" && config["name"].length > 0 ? config["name"] : basename(project);
  const identity: AppIdentity = { name, base: baseOf(config) };
  if (typeof config["title"] === "string") identity.title = config["title"];
  return identity;
};
