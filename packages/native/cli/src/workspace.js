/**
 * @file The workspace as the commands see it: its root, its members (every folder a pnpm-workspace.yaml
 * pattern names that holds a package.json), a member's `native` block and the members it depends
 * on, in dependency order. Light itself is no member. In a workspace that links light (a `light`
 * pattern), the packages under `light/` are members the others depend on, prepared with them, and
 * light's own gates check them: the commands that go over every member leave them out.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

/**
 * @typedef {object} Selftest
 * @property {string[]} [args]
 * @property {Record<string, string>} [home]
 * @property {string} [homeEnv]
 * @property {string} [live]
 * @property {number} [wait]
 * @property {[string, string][]} [checks]
 * @property {string} [noProcessLeft]
 * @property {number} [exitCode]
 */

/**
 * @typedef {object} NativeBlock
 * @property {string} [entry]
 * @property {string} [binary]
 * @property {string} [ffi]
 * @property {string[]} [prepare]
 * @property {Record<string, Selftest>} [selftests]
 * @property {string} [web]
 * @property {{ wait?: number, checks?: [string, string][] }} [selftest]
 * @property {string[]} [npmStatic]
 * @property {boolean} [coverage]
 * @property {boolean} [tooling]
 * @property {boolean} [tests]
 */

/**
 * @typedef {object} PackageJson
 * @property {string} [name]
 * @property {Record<string, string>} [dependencies]
 * @property {Record<string, string>} [devDependencies]
 * @property {Record<string, string>} [peerDependencies]
 * @property {Record<string, unknown>} [exports]
 * @property {NativeBlock} [native]
 */

/** The fields of a package.json that declare dependencies. */
export const DEPENDENCY_FIELDS = /** @type {const} */ (["dependencies", "devDependencies", "peerDependencies"]);

/** Light's folder: this CLI is light's, under packages/native/cli. */
export const LIGHT = resolve(import.meta.dirname, "..", "..", "..", "..");

export class Member {
  /** The package name (`@light/lib`, `widecode`). @type {string} */
  name;
  /** The member's folder, absolute. @type {string} */
  dir;
  /** The workspace group: `packages` or `apps`. @type {string} */
  group;
  /** The parsed package.json. @type {PackageJson} */
  pkg;
  /** The member's folder from the workspace root (`packages/tui/kernel`, `light/packages/native/lib`). @type {string} */
  label;
  /** Whether the workspace's own gates cover it: false for light's packages in a workspace that links light. @type {boolean} */
  own;

  /**
   * @param {string} name
   * @param {string} dir
   * @param {string} group
   * @param {PackageJson} pkg
   * @param {string} label
   * @param {boolean} own
   */
  constructor(name, dir, group, pkg, label, own) {
    this.name = name;
    this.dir = dir;
    this.group = group;
    this.pkg = pkg;
    this.label = label;
    this.own = own;
  }

  /** The member's `native` block (the entry, the ffi manifest, the prepare steps, the selftests). @returns {NativeBlock} */
  get config() {
    return this.pkg.native ?? {};
  }

  /** The members it declares, in any class: every dependency on `workspace:` but light. @returns {string[]} */
  get workspaceDependencies() {
    const out = [];
    for (const key of DEPENDENCY_FIELDS) for (const [name, range] of Object.entries(this.pkg[key] ?? {})) if (range.startsWith("workspace:") && name !== "@bootstrapp/light") out.push(name);
    return out;
  }
}

/**
 * The nearest folder above `from` holding a pnpm-workspace.yaml.
 * @param {string} from
 * @returns {string}
 */
export const findRoot = (from) => {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error("not inside a workspace (no pnpm-workspace.yaml above " + from + ")");
    dir = up;
  }
};

/**
 * The patterns of pnpm-workspace.yaml (`- 'packages/*'` lines).
 * @param {string} root
 * @returns {string[]}
 */
const patterns = (root) => {
  const out = [];
  for (const line of readFileSync(join(root, "pnpm-workspace.yaml"), "utf8").split("\n")) {
    const m = /^\s*-\s*['"]?([^'"#\s]+)['"]?\s*$/.exec(line);
    if (m !== null) out.push(m[1]);
  }
  return out;
};

/**
 * @param {string} dir
 * @returns {PackageJson | null}
 */
const readPackage = (dir) => {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;
  return /** @type {PackageJson} */ (JSON.parse(readFileSync(file, "utf8")));
};

/**
 * Every member but light itself (`@bootstrapp/light`, not a native package), light's linked packages
 * included, packages first, each group by folder.
 * @param {string} root
 * @returns {Member[]}
 */
export const allMembers = (root) => {
  /** @type {Member[]} */
  const out = [];
  for (const pattern of patterns(root)) {
    if (pattern === "light") continue;
    const base = pattern.endsWith("/*") ? join(root, pattern.slice(0, -2)) : null;
    if (base !== null && !existsSync(base)) continue;
    const dirs = base !== null
      ? readdirSync(base)
          .sort()
          .map((name) => join(base, name))
      : [join(root, pattern)];
    for (const dir of dirs) {
      if (!statSync(dir).isDirectory()) continue;
      const pkg = readPackage(dir);
      if (pkg === null || pkg.name === "@bootstrapp/light") continue;
      const label = relative(root, dir);
      out.push(new Member(String(pkg.name ?? basename(dir)), dir, basename(dirname(dir)) === "apps" ? "apps" : "packages", pkg, label, !label.startsWith("light/")));
    }
  }
  out.sort((a, b) => (a.group === b.group ? (a.label < b.label ? -1 : 1) : a.group === "packages" ? -1 : 1));
  return out;
};

/**
 * The members the workspace's own gates cover: every member but light's linked packages.
 * @param {string} root
 * @returns {Member[]}
 */
export const members = (root) => allMembers(root).filter((m) => m.own);

/**
 * The member named `name`: its package name, its folder name, or its path.
 * @param {string} root
 * @param {string} name
 * @returns {Member}
 */
export const memberByName = (root, name) => {
  const all = allMembers(root);
  const dir = resolve(root, name);
  const m = all.find((x) => x.name === name || x.dir === dir || basename(x.dir) === name);
  if (m === undefined) throw new Error("no member named " + name + " (members: " + all.map((x) => x.name).join(", ") + ")");
  return m;
};

/**
 * The apps.
 * @param {string} root
 * @returns {Member[]}
 */
export const apps = (root) => members(root).filter((m) => m.group === "apps");

/**
 * The members `member` depends on, transitively, each before what depends on it.
 * @param {string} root
 * @param {Member} member
 * @returns {Member[]}
 */
export const dependencyMembers = (root, member) => {
  const all = allMembers(root);
  /** @type {Member[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  /** @param {Member} m */
  const visit = (m) => {
    for (const name of m.workspaceDependencies) {
      if (seen.has(name)) continue;
      seen.add(name);
      const dep = all.find((x) => x.name === name);
      if (dep === undefined) throw new Error(m.name + " depends on " + name + ", which is not a member");
      visit(dep);
      out.push(dep);
    }
  };
  visit(member);
  return out;
};

/**
 * The workspace's TypeScript compiler.
 * @param {string} root
 * @returns {string}
 */
export const tscPath = (root) => {
  const bin = join(root, "node_modules", ".bin", "tsc");
  if (!existsSync(bin)) throw new Error("typescript is not installed at the root: run pnpm install");
  return bin;
};
