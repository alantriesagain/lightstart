/**
 * @file FFI manifests as the members name them: an app's `native.ffi`, or a test's first line
 * `// ffi: <manifest>`, either a package path (`@light/plugins/native/ffi.json`, reached through the
 * member's node_modules so the package's own folder holds the archive the manifest names) or a
 * path relative to the member. Under node the manifest folder's `*-node.mjs` plays the native
 * calls on node's engine, preloaded with `--import`.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Member } from "./workspace.js";

/**
 * The manifest a source names on its first line, or null.
 * @param {string} file
 * @returns {string | null}
 */
export const ffiHeader = (file) => {
  const first = readFileSync(file, "utf8").split("\n", 1)[0];
  const m = /^\/\/ ffi: (\S+)\s*$/.exec(first);
  return m === null ? null : m[1];
};

/**
 * Whether a source's first line marks it node-only (`// node-only`).
 * @param {string} file
 * @returns {boolean}
 */
export const nodeOnly = (file) => /^\/\/ node-only\b/.test(readFileSync(file, "utf8").split("\n", 1)[0]);

/**
 * The manifest `spec` names from `member`, absolute and real.
 * @param {Member} member
 * @param {string} spec
 * @returns {string}
 */
export const resolveFfi = (member, spec) => {
  let path;
  if (spec.startsWith("@")) {
    const parts = spec.split("/");
    const pkg = parts.slice(0, 2).join("/");
    path = join(member.dir, "node_modules", pkg, ...parts.slice(2));
    if (!existsSync(path)) throw new Error(member.name + ": " + spec + " is not reachable (is " + pkg + " declared and installed?)");
  } else path = resolve(member.dir, spec);
  if (!existsSync(path)) throw new Error(member.name + ": no ffi manifest at " + path);
  return realpathSync(path);
};

/**
 * The node stand-in beside a manifest (`<name>-node.mjs`), or null.
 * @param {string} manifest
 * @returns {string | null}
 */
export const nodePreload = (manifest) => {
  const dir = dirname(manifest);
  const name = readdirSync(dir).find((f) => f.endsWith("-node.mjs"));
  return name === undefined ? null : join(dir, name);
};
