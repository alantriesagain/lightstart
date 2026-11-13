/**
 * @file The importmap a dev page needs: a package's own entries and those of the packages it
 * declares, merged with the map an `index.html` already carries (the page's entries win).
 */
import { join, relative, sep } from "node:path";

/** A bare specifier and the URL path it resolves to. */
export type ImportMap = Record<string, string>;

/** The parts of a `package.json` the importmap reads. */
export type PackageManifest = {
  name?: unknown;
  exports?: unknown;
  main?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const entryOf = (target: unknown): string | null => {
  if (typeof target === "string") return target;
  if (!isRecord(target)) return null;
  for (const condition of ["default", "import", "browser", "node", "require"]) {
    const entry = target[condition];
    if (typeof entry === "string") return entry;
    const nested = entryOf(entry);
    if (nested !== null) return nested;
  }
  return null;
};

const exportsOf = (pkg: PackageManifest): Array<[string, string]> => {
  const value = pkg.exports;
  if (typeof value === "string") return [["." , value]];
  if (isRecord(value)) {
    const out: Array<[string, string]> = [];
    for (const [key, target] of Object.entries(value)) {
      const entry = entryOf(target);
      if (entry !== null) out.push([key, entry]);
    }
    return out;
  }
  return [["." , typeof pkg.main === "string" ? pkg.main : "./index.js"]];
};

const urlOf = (root: string, dir: string, file: string): string => {
  const rel = relative(root, join(dir, file)).split(sep).join("/");
  return "/" + rel;
};

/** The entries one package contributes, its `exports` read against `dir`. */
export const packageImports = (root: string, dir: string, pkg: PackageManifest): Array<[string, string]> => {
  if (typeof pkg.name !== "string" || pkg.name === "") return [];
  const name = pkg.name;
  const out: Array<[string, string]> = [];
  for (const [key, entry] of exportsOf(pkg)) {
    if (key === ".") out.push([name, urlOf(root, dir, entry)]);
    else if (key === "./*") out.push([name + "/", dir === root ? "/" : urlOf(root, dir, "") + "/"]);
    else if (key.startsWith("./") && !key.includes("*")) out.push([name + "/" + key.slice(2), urlOf(root, dir, entry)]);
  }
  return out;
};

/** The importmap of the packages whose manifests are given: the root first, then its dependencies. */
export const importMapFor = (root: string, packages: ReadonlyArray<{ dir: string; pkg: PackageManifest }>): ImportMap => {
  const pairs: Array<[string, string]> = [];
  for (const entry of packages) for (const pair of packageImports(root, entry.dir, entry.pkg)) pairs.push(pair);
  return Object.fromEntries(pairs);
};

/** The declared package names of a manifest, in dependency, devDependency, peerDependency order. */
export const declaredPackages = (pkg: PackageManifest | null): string[] => {
  if (pkg === null) return [];
  const out: string[] = [];
  for (const section of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
    if (!isRecord(section)) continue;
    for (const name of Object.keys(section)) if (!out.includes(name)) out.push(name);
  }
  return out;
};

/** `base` with `page`'s entries on top. */
export const mergeImportMaps = (base: ImportMap, page: ImportMap): ImportMap => ({ ...base, ...page });

const IMPORTMAP_SCRIPT = /<script\b[^>]*\btype\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;

/** The `imports` of the importmap an HTML page already carries, empty when it has none or it is not JSON. */
export const importmapFromHtml = (html: string): ImportMap => {
  const found = IMPORTMAP_SCRIPT.exec(html);
  if (found === null || found[1] === undefined) return {};
  try {
    const data: unknown = JSON.parse(found[1]);
    if (!isRecord(data) || !isRecord(data["imports"])) return {};
    const pairs: Array<[string, string]> = [];
    for (const [specifier, target] of Object.entries(data["imports"])) if (typeof target === "string") pairs.push([specifier, target]);
    return Object.fromEntries(pairs);
  } catch {
    return {};
  }
};
