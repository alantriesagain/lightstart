/**
 * @file The file system as discovery reads it: `walkFiles`, `readPackageJson`, the scoped
 * packages under a `node_modules`, and the nearest workspace root. The core has its own copies of
 * what it needs, so it never reaches this module.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export type PackageJson = {
  name?: string;
  exports?: unknown;
  [key: string]: unknown;
};

export type WalkOptions = {
  extensions?: readonly string[];
  recursive?: boolean;
  skipTests?: boolean;
  prune?: (name: string, rel: string) => boolean;
  keep?: (name: string, rel: string) => boolean;
};

export type ScopedPackage = {
  name: string;
  shortName: string;
  scope: string;
  dir: string;
  root: string;
  pkg: PackageJson;
};

const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** A parsed package.json as a manifest, or null when it is not a JSON object. */
export const asPackageJson = (value: unknown): PackageJson | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as PackageJson) : null;

/** Parse `<dir>/package.json`; null when missing or malformed. */
export const readPackageJson = (dir: string): PackageJson | null => {
  try {
    return asPackageJson(JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")));
  } catch {
    return null;
  }
};

/** The posix path of `abs` relative to `root`. */
export const toRel = (root: string, abs: string): string => relative(root, abs).split("\\").join("/");

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

type ResolvedWalk = {
  extensions: readonly string[];
  recursive: boolean;
  skipTests: boolean;
  prune?: (name: string, rel: string) => boolean;
  keep?: (name: string, rel: string) => boolean;
};

const walk = (base: string, dir: string, options: ResolvedWalk, out: string[]): void => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => byName(a.name, b.name));
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = toRel(base, full);
    const directory = entry.isDirectory() || (entry.isSymbolicLink() && isDir(full));
    if (directory) {
      if (options.recursive && !(options.prune && options.prune(entry.name, rel))) walk(base, full, options, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (options.skipTests && entry.name.includes(".test.")) continue;
    if (!options.extensions.some((ext: string): boolean => entry.name.endsWith(ext))) continue;
    if (options.keep && !options.keep(entry.name, rel)) continue;
    out.push(full);
  }
};

/** List files under a directory, sorted per level. A missing directory answers `[]`. */
export const walkFiles = (dir: string, options: WalkOptions = {}): string[] => {
  const out: string[] = [];
  walk(
    dir,
    dir,
    {
      extensions: options.extensions ?? [".js"],
      recursive: options.recursive ?? true,
      skipTests: options.skipTests ?? true,
      prune: options.prune,
      keep: options.keep,
    },
    out,
  );
  return out;
};

/**
 * The scoped packages under each root's `node_modules/<scope>`, sorted per root and scope, each
 * with a readable package.json. A package found under an earlier root wins.
 */
export const listScopedPackages = ({ roots, scopes }: { roots: readonly string[]; scopes: readonly string[] }): ScopedPackage[] => {
  const out: ScopedPackage[] = [];
  const seen = new Set<string>();
  for (const root of roots)
    for (const scope of scopes) {
      const scopedDir = join(root, "node_modules", scope);
      let shortNames: string[] = [];
      try {
        shortNames = readdirSync(scopedDir).sort();
      } catch {
        continue;
      }
      for (const shortName of shortNames) {
        const dir = join(scopedDir, shortName);
        if (!isDir(dir)) continue;
        const pkg = readPackageJson(dir);
        if (!pkg) continue;
        const key = `${scope}/${shortName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: typeof pkg.name === "string" && pkg.name ? pkg.name : key, shortName, scope, dir, root, pkg });
      }
    }
  return out;
};

/** Whether `<dir>/package.json` declares `workspaces`. */
const declaresWorkspaces = (dir: string): boolean => {
  const pkg = readPackageJson(dir);
  return pkg !== null && pkg.workspaces !== undefined;
};

/**
 * The nearest folder at or above `start` (8 levels at most) holding a `pnpm-workspace.yaml` or a
 * `package.json` with `workspaces`.
 */
export const findWorkspaceRoot = (start: string): string | null => {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    try {
      statSync(join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch {}
    if (declaresWorkspaces(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
};
