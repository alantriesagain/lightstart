/**
 * @bootstrapp/light/check/walk.js: the file system as the checker reads it.
 * `walkFiles` lists a directory's files sorted per level, `readPackageJson`
 * parses a manifest or answers null, `toRel` makes a posix path relative to a
 * root.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** @import { PackageJson, WalkOptions } from "./types.ts" */

/** @param {string} p */
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/**
 * A parsed package.json as a manifest, or null when it is not a JSON object.
 * Its members keep the shapes JSON gave them; a reader checks each one.
 * @param {unknown} value
 * @returns {PackageJson | null}
 */
export const asPackageJson = (value) => (value !== null && typeof value === "object" && !Array.isArray(value) ? /** @type {PackageJson} */ (value) : null);

/**
 * Parse `<dir>/package.json`; null when missing or malformed.
 * @param {string} dir
 * @returns {PackageJson | null}
 */
export const readPackageJson = (dir) => {
  try {
    return asPackageJson(JSON.parse(readFileSync(path.join(dir, "package.json"), "utf-8")));
  } catch {
    return null;
  }
};

/**
 * @param {string} root
 * @param {string} abs
 */
export const toRel = (root, abs) => path.relative(root, abs).split(path.sep).join("/");

/** @param {{ name: string }} a @param {{ name: string }} b */
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * @param {string} base
 * @param {string} dir
 * @param {Required<Pick<WalkOptions, "extensions" | "recursive" | "skipTests">> & Pick<WalkOptions, "prune" | "keep">} options
 * @param {string[]} out
 */
const walk = (base, dir, options, out) => {
  /** @type {import("node:fs").Dirent[]} */
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries.sort(byName)) {
    const full = path.join(dir, e.name);
    const rel = toRel(base, full);
    if (e.isDirectory() || (e.isSymbolicLink() && isDir(full))) {
      if (options.recursive && !options.prune?.(e.name, rel)) walk(base, full, options, out);
      continue;
    }
    if (!e.isFile()) continue;
    if (options.skipTests && e.name.includes(".test.")) continue;
    if (!options.extensions.some((ext) => e.name.endsWith(ext))) continue;
    if (options.keep && !options.keep(e.name, rel)) continue;
    out.push(full);
  }
};

/**
 * List files under a directory, sorted per directory level. `prune` skips a
 * subdirectory, `keep` filters files; both receive the entry name and its
 * posix path relative to `dir`. A missing directory answers `[]`.
 * @param {string} dir
 * @param {WalkOptions} [options]
 * @returns {string[]}
 */
export const walkFiles = (dir, { extensions = [".js"], recursive = true, skipTests = true, prune, keep } = {}) => {
  /** @type {string[]} */
  const out = [];
  walk(dir, dir, { extensions, recursive, skipTests, prune, keep }, out);
  return out;
};
