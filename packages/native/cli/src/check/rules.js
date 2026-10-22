/**
 * @file The conventions every member follows, each a rule answering findings for one member: a relative
 * import never leaves the member; every import of a member or of `@bootstrapp/light` is declared, as
 * `workspace:*`; a package's export targets are TypeScript files and `./*` its only pattern (a
 * `.js` target would make the package an npm package to scriptc); a `// ffi:` header names a
 * manifest that exists; a member's tsconfig equals the template; a test names no path from the
 * workspace root; a member with sources has tests.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { DEPENDENCY_FIELDS, Member } from "../workspace.js";

export class Finding {
  /** @type {string} */
  rule;
  /** @type {string} */
  file;
  /** @type {string} */
  message;

  /**
   * @param {string} rule
   * @param {string} file
   * @param {string} message
   */
  constructor(rule, file, message) {
    this.rule = rule;
    this.file = file;
    this.message = message;
  }
}

const SKIP = new Set(["node_modules", "dist", "out", ".scriptc", "examples"]);

/**
 * The member's source and test files (.ts, .js, .mjs), absolute.
 * @param {Member} m
 * @returns {string[]}
 */
export const sourcesOf = (m) => {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || name.startsWith(".")) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|js|mjs)$/.test(name)) out.push(path);
    }
  };
  walk(m.dir);
  return out.sort();
};

const IMPORT = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm;
const SIDE_IMPORT = /^\s*import\s+["']([^"']+)["']/gm;

/**
 * Every specifier a file imports or re-exports.
 * @param {string} text
 * @returns {string[]}
 */
export const specifiersOf = (text) => {
  /** @type {string[]} */
  const out = [];
  for (const m of text.matchAll(IMPORT)) out.push(m[1]);
  for (const m of text.matchAll(SIDE_IMPORT)) out.push(m[1]);
  return out;
};

/**
 * The package a bare specifier names (`@light/lib/json.ts` → `@light/lib`), or null for a relative or node one.
 * @param {string} spec
 * @returns {string | null}
 */
export const packageOf = (spec) => {
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) return null;
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

/**
 * @param {Member} m
 * @returns {Finding[]}
 */
export const noCrossMemberRelativeImport = (m) => {
  /** @type {Finding[]} */
  const out = [];
  for (const file of sourcesOf(m))
    for (const spec of specifiersOf(readFileSync(file, "utf8"))) {
      if (!spec.startsWith(".")) continue;
      const target = resolve(dirname(file), spec);
      if (relative(m.dir, target).startsWith("..")) out.push(new Finding("no-cross-member-relative-import", file, spec + " leaves the member: import the package by name"));
    }
  return out;
};

/**
 * @param {Member} m
 * @param {Set<string>} names
 * @returns {Finding[]}
 */
export const undeclaredDeps = (m, names) => {
  /** @type {Finding[]} */
  const out = [];
  const declared = new Set();
  for (const key of DEPENDENCY_FIELDS) for (const name of Object.keys(m.pkg[key] ?? {})) declared.add(name);
  /** @type {Set<string>} */
  const seen = new Set();
  for (const file of sourcesOf(m))
    for (const spec of specifiersOf(readFileSync(file, "utf8"))) {
      const pkg = packageOf(spec);
      if (pkg === null || pkg === m.name) continue;
      if (!names.has(pkg) && pkg !== "@bootstrapp/light") continue;
      if (declared.has(pkg) || seen.has(pkg)) continue;
      seen.add(pkg);
      out.push(new Finding("undeclared-deps", file, pkg + " is imported but not declared in package.json"));
    }
  return out;
};

/**
 * @param {Member} m
 * @param {Set<string>} names
 * @returns {Finding[]}
 */
export const workspaceProtocol = (m, names) => {
  /** @type {Finding[]} */
  const out = [];
  for (const key of DEPENDENCY_FIELDS)
    for (const [name, range] of Object.entries(m.pkg[key] ?? {}))
      if ((names.has(name) || name === "@bootstrapp/light") && range !== "workspace:*") out.push(new Finding("workspace-protocol", join(m.dir, "package.json"), name + " is " + range + ", not workspace:*"));
  return out;
};

/**
 * @param {Member} m
 * @returns {Finding[]}
 */
export const exportsTargetsTs = (m) => {
  /** @type {Finding[]} */
  const out = [];
  if (m.group !== "packages" || m.config.tooling === true) return out;
  const file = join(m.dir, "package.json");
  const exp = m.pkg.exports;
  if (exp === undefined) {
    out.push(new Finding("exports-targets-ts", file, "a package declares its exports"));
    return out;
  }
  for (const [key, target] of Object.entries(exp)) {
    if (key.includes("*")) {
      if (key !== "./*" || target !== "./*") out.push(new Finding("exports-targets-ts", file, "the only pattern export is \"./*\": \"./*\""));
      continue;
    }
    const t = typeof target === "string" ? target : null;
    if (t === null || !t.endsWith(".ts")) out.push(new Finding("exports-targets-ts", file, key + " must name a .ts file (scriptc compiles a linked package as source only through a .ts target)"));
    else if (!existsSync(join(m.dir, t))) out.push(new Finding("exports-targets-ts", file, key + " names " + t + ", which does not exist"));
  }
  return out;
};

/**
 * @param {Member} m
 * @returns {Finding[]}
 */
export const ffiHeaderValid = (m) => {
  /** @type {Finding[]} */
  const out = [];
  for (const file of sourcesOf(m)) {
    const first = readFileSync(file, "utf8").split("\n", 1)[0];
    const h = /^\/\/ ffi: (\S+)\s*$/.exec(first);
    if (h === null) continue;
    const spec = h[1];
    let path;
    if (spec.startsWith("@")) {
      const pkg = packageOf(spec) ?? "";
      const declared = Object.hasOwn(m.pkg.dependencies ?? {}, pkg) || Object.hasOwn(m.pkg.devDependencies ?? {}, pkg);
      if (!declared && pkg !== m.name) out.push(new Finding("ffi-header-valid", file, "the manifest's package " + pkg + " is not declared"));
      path = join(m.dir, "node_modules", spec);
    } else path = resolve(m.dir, spec);
    if (!existsSync(path)) out.push(new Finding("ffi-header-valid", file, "no manifest at " + spec));
  }
  return out;
};

/**
 * @param {Member} m
 * @param {string} template
 * @returns {Finding[]}
 */
export const tsconfigCanonical = (m, template) => {
  const file = join(m.dir, "tsconfig.json");
  if (!existsSync(file)) return [new Finding("tsconfig-canonical", file, "every member has a tsconfig.json (the template in @light/cli's templates/)")];
  const own = JSON.parse(readFileSync(file, "utf8"));
  const want = JSON.parse(template);
  if (JSON.stringify(own.compilerOptions) !== JSON.stringify(want.compilerOptions)) return [new Finding("tsconfig-canonical", file, "compilerOptions differ from @light/cli's templates/tsconfig.json (scriptc applies the entry's options to every file it compiles)")];
  return [];
};

/**
 * @param {Member} m
 * @returns {Finding[]}
 */
export const noRootPathsInTests = (m) => {
  /** @type {Finding[]} */
  const out = [];
  const dir = join(m.dir, "test");
  if (!existsSync(dir)) return out;
  for (const file of sourcesOf(m)) {
    if (!file.startsWith(dir + "/")) continue;
    const text = readFileSync(file, "utf8");
    const bad = /["'`](?:apps|packages)\/[a-z]/.exec(text);
    if (bad !== null) out.push(new Finding("no-root-paths-in-tests", file, "a test runs from the member's folder: " + bad[0] + "… names a path from the workspace root"));
  }
  return out;
};

/**
 * @param {Member} m
 * @returns {Finding[]}
 */
export const testsDir = (m) => {
  if (m.config.tests === false || m.config.tooling === true) return [];
  const has = sourcesOf(m).some((f) => f.startsWith(join(m.dir, "test") + "/") && f.endsWith(".test.ts"));
  return has ? [] : [new Finding("tests-dir", m.dir, "a member with sources has test/*.test.ts (or \"native\": { \"tests\": false } saying why not)")];
};

/**
 * Every rule over `m`; `names` are the workspace's members.
 * @param {Member} m
 * @param {string} template
 * @param {Set<string>} names
 * @returns {Finding[]}
 */
export const checkMember = (m, template, names) => [
  ...noCrossMemberRelativeImport(m),
  ...undeclaredDeps(m, names),
  ...workspaceProtocol(m, names),
  ...exportsTargetsTs(m),
  ...ffiHeaderValid(m),
  ...tsconfigCanonical(m, template),
  ...noRootPathsInTests(m),
  ...testsDir(m),
];

/**
 * A finding's line for the terminal.
 * @param {Finding} f
 * @param {string} root
 * @returns {string}
 */
export const describe = (f, root) => relative(root, f.file) + ": " + f.message + " [" + f.rule + "]";
export const RULE_NAMES = ["no-cross-member-relative-import", "undeclared-deps", "workspace-protocol", "exports-targets-ts", "ffi-header-valid", "tsconfig-canonical", "no-root-paths-in-tests", "tests-dir"];
export const memberLabel = (/** @type {Member} */ m) => m.label;
