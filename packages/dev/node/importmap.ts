/**
 * @file Reading the project's `package.json` and building its importmap from the packages it
 * declares under `node_modules`; node-only because it reads the disk.
 */
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { declaredPackages, importMapFor, type ImportMap, type PackageManifest } from "../importmap.ts";

/** The project's `package.json`, or null when it has none or it is not JSON. */
export const readPackageJson = (dir: string): PackageManifest | null => {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as PackageManifest) : null;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** `light.dev.port` from a manifest, when it is a number. */
export const devPortOf = (pkg: PackageManifest | null): number | null => {
  if (pkg === null) return null;
  const light = (pkg as Record<string, unknown>)["light"];
  if (!isRecord(light)) return null;
  const dev = light["dev"];
  if (!isRecord(dev)) return null;
  return typeof dev["port"] === "number" ? dev["port"] : null;
};

/**
 * The folder a package is served from: its real path when that lies inside the project, so a
 * workspace package linked into `node_modules` has one URL, the one a page's own importmap names.
 */
const servedDir = (projectDir: string, dir: string): string => {
  const real = realpathSync(dir);
  const rel = relative(realpathSync(projectDir), real);
  return rel === "" || rel === ".." || rel.startsWith(`..${sep}`) ? dir : join(projectDir, rel);
};

/** The project's own entries and those of every package it declares and has in `node_modules`. */
export const buildImportMap = (projectDir: string): ImportMap => {
  const root = readPackageJson(projectDir);
  const packages: Array<{ dir: string; pkg: PackageManifest }> = [];
  if (root !== null) packages.push({ dir: projectDir, pkg: root });
  for (const name of declaredPackages(root)) {
    const dir = join(projectDir, "node_modules", name);
    const pkg = readPackageJson(dir);
    if (pkg !== null) packages.push({ dir: servedDir(projectDir, dir), pkg });
  }
  return importMapFor(projectDir, packages);
};

