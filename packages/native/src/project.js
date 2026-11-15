/**
 * @file A standalone native project beside the workspace: the nearest folder above a start folder
 * whose package.json holds a `native` block, and the packages it depends on, found through its
 * `node_modules` (a `link:` symlink or an installed folder alike) and walked as a closure in
 * dependency order. A package installed as a real folder inside `node_modules` is expected
 * prebuilt: the project does not write to it.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { Member } from "./workspace.js";

/**
 * @typedef {import("./workspace.js").PackageJson} PackageJson
 */

/**
 * A package of a project's closure: the project itself or one of its dependencies, with the
 * dependencies it declares resolved from its real folder.
 */
export class Project extends Member {
  /** The folder the package really lives in, symbolic links resolved. @type {string} */
  realDir;
  /** The packages this one depends on, direct and resolved. @type {Project[]} */
  dependencies;

  /**
   * @param {string} name
   * @param {string} dir
   * @param {string} realDir
   * @param {PackageJson} pkg
   */
  constructor(name, dir, realDir, pkg) {
    super(name, dir, "apps", pkg, ".", true);
    this.realDir = realDir;
    this.dependencies = [];
  }
}

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
 * Whether a package's real folder lies inside a `node_modules` folder: an installed package, not
 * a link to a checkout.
 * @param {Project} project
 * @returns {boolean}
 */
export const isInstalled = (project) => project.realDir.split(sep).includes("node_modules");

/**
 * `name` as node resolves it from `from`: the nearest `node_modules/<name>` at or above it.
 * @param {string} from
 * @param {string} name
 * @returns {string | null}
 */
const resolvePackage = (from, name) => {
  let dir = from;
  for (;;) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(candidate)) return realpathSync(candidate);
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
};

/**
 * The nearest folder above `from` whose package.json holds a `native` block.
 * @param {string} [from]
 * @returns {Project}
 */
export const findProject = (from = process.env["LIGHT_PROJECT_DIR"] ?? process.cwd()) => {
  let dir = resolve(from);
  for (;;) {
    const pkg = readPackage(dir);
    if (pkg !== null && typeof pkg.native === "object" && pkg.native !== null) return loadPackage(dir, String(pkg.name ?? dir.slice(dir.lastIndexOf(sep) + 1)), pkg, new Map());
    const up = dirname(dir);
    if (up === dir) throw new Error("not inside a native project (no package.json with a native block above " + from + ")");
    dir = up;
  }
};

/**
 * A package at `dir`, its dependencies resolved from its real folder and loaded the same way.
 * @param {string} dir
 * @param {string} name
 * @param {PackageJson} pkg
 * @param {Map<string, Project>} seen
 * @returns {Project}
 */
const loadPackage = (dir, name, pkg, seen) => {
  const realDir = realpathSync(dir);
  const found = seen.get(realDir);
  if (found !== undefined) return found;
  const project = new Project(name, dir, realDir, pkg);
  seen.set(realDir, project);
  /** @type {Project[]} */
  const dependencies = [];
  for (const field of /** @type {const} */ (["dependencies", "devDependencies"]))
    for (const dependency of Object.keys(pkg[field] ?? {})) {
      const dependencyDir = resolvePackage(realDir, dependency);
      if (dependencyDir === null) continue;
      const dependencyPkg = readPackage(dependencyDir);
      if (dependencyPkg === null) continue;
      dependencies.push(loadPackage(dependencyDir, String(dependencyPkg.name ?? dependency), dependencyPkg, seen));
    }
  project.dependencies = dependencies;
  return project;
};

/**
 * The project's dependencies, transitively, each before what depends on it and each once.
 * @param {Project} project
 * @returns {Project[]}
 */
export const dependencyClosure = (project) => {
  /** @type {Project[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set([project.realDir]);
  /**
   * @param {Project} node
   */
  const visit = (node) => {
    for (const dependency of node.dependencies) {
      if (seen.has(dependency.realDir)) continue;
      seen.add(dependency.realDir);
      visit(dependency);
      out.push(dependency);
    }
  };
  visit(project);
  return out;
};
