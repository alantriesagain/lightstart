/**
 * @file FFI manifests as the members name them: an app's `native.ffi`, or a test's first line
 * `// ffi: <manifest>`, either a package path (`@lightstart/plugins/native/ffi.json`, reached through the
 * member's node_modules so the package's own folder holds the archive the manifest names) or a
 * path relative to the member. Under node the manifest folder's `*-node.mjs` plays the native
 * calls on node's engine, preloaded with `--import`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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
 * Whether a source marks itself native-only (`// native-only`, on its first or
 * second line, beside an `// ffi:` header).
 * @param {string} file
 * @returns {boolean}
 */
export const nativeOnly = (file) => readFileSync(file, "utf8").split("\n", 2).some((line) => /^\/\/ native-only\b/.test(line));

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
 * The app's FFI manifest: `native.ffi` names one, or several that are merged into one file under the
 * app's dist/ (scriptc takes one). A library path in a manifest is relative to that manifest, so a
 * merged one names every library by its absolute path.
 * @param {Member} app
 * @returns {string | null}
 */
export const resolveAppFfi = (app) => {
  const spec = app.config.ffi;
  if (typeof spec === "string") return resolveFfi(app, spec);
  if (!Array.isArray(spec) || spec.length === 0) return null;
  const paths = spec.map((one) => resolveFfi(app, one));
  if (paths.length === 1) return paths[0];
  /** @type {{ ffi_format: number, functions: unknown[], libraries: string[], system_libraries: string[], frameworks: string[], callbacks: unknown[] }} */
  const merged = { ffi_format: 1, functions: [], libraries: [], system_libraries: [], frameworks: [], callbacks: [] };
  const names = new Set();
  const symbols = new Set();
  for (const path of paths) {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const format = Number(raw.ffi_format);
    if (!Number.isFinite(format)) throw new Error(path + ": ffi_format is not a number");
    if (format > merged.ffi_format) merged.ffi_format = format;
    const dir = dirname(path);
    for (const fn of raw.functions ?? []) {
      if (typeof fn.name === "string") {
        if (names.has(fn.name)) throw new Error("ffi function " + fn.name + " is declared in two manifests");
        names.add(fn.name);
      }
      if (typeof fn.symbol === "string") {
        if (symbols.has(fn.symbol)) throw new Error("ffi symbol " + fn.symbol + " is declared in two manifests");
        symbols.add(fn.symbol);
      }
      merged.functions.push(fn);
    }
    for (const lib of raw.libraries ?? []) merged.libraries.push(resolve(dir, lib));
    for (const lib of raw.system_libraries ?? []) merged.system_libraries.push(lib);
    for (const name of raw.frameworks ?? []) merged.frameworks.push(name);
    for (const cb of raw.callbacks ?? []) merged.callbacks.push(cb);
  }
  merged.system_libraries = [...new Set(merged.system_libraries)];
  merged.frameworks = [...new Set(merged.frameworks)];
  const output = {
    ffi_format: merged.ffi_format,
    functions: merged.functions,
    libraries: merged.libraries,
    system_libraries: merged.system_libraries,
    frameworks: merged.frameworks,
    ...(merged.callbacks.length > 0 ? { callbacks: merged.callbacks } : {}),
  };
  const out = join(app.dir, "dist", "ffi-merged.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(output) + "\n");
  return out;
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
