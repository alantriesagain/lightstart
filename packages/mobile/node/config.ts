/**
 * @file Read a project's `src/mobile.ts` or `.js` and `src/app.ts` or `.js`
 * the way the app generator reads them: without their views, and with an error
 * naming both files when a project has both languages.
 */

import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { isOrientation, type MobileConfig, type ResolvedMobile } from "../index.ts";

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

/** The project's `src/mobile.ts` or `.js`; null when it has none, an error naming both when it has both. */
export const mobilePathOf = (project: string): string | null => sourcePathOf(project, "mobile");

/** The project's `src/app.ts` or `.js`; null when it has none, an error naming both when it has both. */
export const appPathOf = (project: string): string | null => sourcePathOf(project, "app");

const load = async (path: string): Promise<unknown> => (await import(`${pathToFileURL(path).href}?mtime=${String(Date.now())}`) as { default?: unknown }).default;

const configOf = (value: unknown, path: string): MobileConfig => {
  if (!isRecord(value)) throw new Error(`${path} default-exports no mobile config; use defineMobile({ ... })`);
  const appId = value["appId"];
  if (typeof appId !== "string" || appId.trim() === "") throw new Error(`${path} has no appId; defineMobile({ appId: "com.example.app", ... })`);
  const orientation = value["orientation"];
  if (orientation !== undefined && !isOrientation(orientation)) throw new Error(`${path} has orientation ${JSON.stringify(orientation)}; use "portrait", "landscape" or "any"`);
  return value as unknown as MobileConfig;
};

/** The config `src/mobile` default-exports, or null when the project has no `src/mobile`; an import that throws is the caller's error. */
export const readMobile = async (project: string): Promise<MobileConfig | null> => {
  const path = mobilePathOf(project);
  if (path === null) return null;
  return configOf(await load(path), path);
};

/** The app fields the shell defaults to: its name, its title and its deploy base. */
export interface AppIdentity {
  name: string;
  title?: string;
  base: string;
}

const normalizeBase = (value: string): string => {
  const trimmed = value.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

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

/** Read `src/app` for the shell's defaults; the folder's name when the project has no app module. */
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

const positive = (value: unknown, fallback: number, label: string): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
};

/** Fill a config's defaults from the app identity and refuse values Android cannot use. */
export const resolveMobile = (config: MobileConfig, identity: AppIdentity): ResolvedMobile => {
  const name = config.name ?? identity.title ?? identity.name;
  const version = { name: config.version?.name ?? "0.1.0", code: positive(config.version?.code, 1, "version.code") };
  const resolved: ResolvedMobile = {
    appId: config.appId,
    name,
    version,
    orientation: config.orientation ?? "any",
    minSdk: positive(config.minSdk, 26, "minSdk"),
    base: identity.base,
  };
  if (config.shareTarget !== undefined) resolved.shareTarget = config.shareTarget;
  if (config.cameraApp !== undefined) resolved.cameraApp = config.cameraApp;
  return resolved;
};
