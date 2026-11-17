/**
 * @lightstart/light/check/discover.js: where rules come from. A rule is one
 * file under a `check/rules/` directory, its id `<owner>/<basename>`; light's
 * own rules are owned by `light`, a project's by its name, a dependency's by
 * the name after its scope: every `@lightstart/*` dependency of the project
 * and every package its `light.check.from` names. `loadRulesSync` loads the same
 * files without waiting, for a caller that cannot (an eslint rule); a rule
 * module with top-level `await` fails to load there.
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateRuleShape } from "./define.js";
import { walkFiles } from "./walk.js";

/** @import { PackageJson, ProjectModel, RuleEntry, RuleSource } from "./types.ts" */

/** @typedef {{ entry: RuleEntry } | { warning: string, own?: boolean }} Loaded */

const LIGHT_ROOT = fileURLToPath(new URL("../", import.meta.url));
/** @type {(id: string) => unknown} */
const require = createRequire(import.meta.url);

/** @param {string} dir */
export const listRuleFiles = (dir) => walkFiles(dir, { recursive: false });

/**
 * The rule files of `<dir>/check/rules`, each owned by `owner`; `own` marks
 * light's built-in rules.
 * @param {string} owner
 * @param {string} dir
 * @param {boolean} [own]
 * @returns {RuleSource[]}
 */
export const ruleSources = (owner, dir, own = false) => listRuleFiles(path.join(dir, "check", "rules")).map((file) => ({ owner, file, ...(own ? { own } : {}) }));

/** Light's own rules. */
export const ownRuleSources = () => ruleSources("light", LIGHT_ROOT, true);

/**
 * The project's own rules, owned by the name after the slash.
 * @param {string} projectDir
 * @param {PackageJson | null} pkg
 */
export const projectRuleSources = (projectDir, pkg) => ruleSources(/** @type {string} */ ((pkg?.name || "project").split("/").pop()), projectDir);

/**
 * The folder of package `name` as the project at `projectDir` resolves it, or null.
 * @param {string} projectDir
 * @param {string} name
 * @returns {string | null}
 */
const packageDir = (projectDir, name) => {
  try {
    return path.dirname(createRequire(path.join(projectDir, "package.json")).resolve(`${name}/package.json`));
  } catch {
    const dir = path.join(projectDir, "node_modules", name);
    return existsSync(path.join(dir, "package.json")) ? dir : null;
  }
};

/**
 * The rules the project's dependencies ship in their `check/rules/`: every
 * `@lightstart/*` dependency (light's own rules are already there) and every
 * package `light.check.from` names, each owned by the name after its scope
 * (`@lightstart/components` owns `components/<rule>`). A package the project
 * cannot resolve is left out.
 * @param {string} projectDir
 * @param {PackageJson | null} pkg
 * @returns {RuleSource[]}
 */
export const dependencyRuleSources = (projectDir, pkg) => {
  const deps = Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.peerDependencies }).filter((name) => name.startsWith("@lightstart/") && name !== "@lightstart/light");
  const from = pkg?.light?.check?.from ?? pkg?.bootstrapp?.check?.from ?? [];
  return [...new Set([...deps, ...from])].flatMap((name) => {
    const dir = packageDir(projectDir, name);
    return dir === null ? [] : ruleSources(/** @type {string} */ (name.split("/").pop()), dir);
  });
};

/**
 * @param {string} owner
 * @param {string} file
 */
const ruleId = (owner, file) => `${owner}/${path.basename(file, ".js")}`;

/**
 * @param {string} owner
 * @param {string} file
 * @param {{ default?: unknown }} mod
 * @returns {Loaded}
 */
const entryOf = (owner, file, mod) => {
  const id = ruleId(owner, file);
  const problem = validateRuleShape(mod.default);
  if (problem) return { warning: `rule ${id} skipped: ${problem} (${file})` };
  return { entry: { id, owner, file, rule: /** @type {RuleEntry["rule"]} */ (mod.default) } };
};

/**
 * @param {string} owner
 * @param {string} file
 * @param {unknown} e
 * @param {boolean} own
 * @returns {Loaded}
 */
const loadFailed = (owner, file, e, own) => ({ warning: `rule ${ruleId(owner, file)} failed to load: ${e instanceof Error ? e.message : e}`, ...(own ? { own } : {}) });

/**
 * The sources once each, the first owner of a file winning.
 * @param {RuleSource[]} sources
 */
const unique = (sources) => {
  const seen = new Set();
  return sources.filter(({ file }) => !seen.has(file) && seen.add(file));
};

/** @param {Loaded[]} loaded */
const collect = (loaded) => {
  /** @type {RuleEntry[]} */
  const rules = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const failures = [];
  for (const one of loaded)
    if ("warning" in one) {
      warnings.push(one.warning);
      if (one.own) failures.push(one.warning);
    } else rules.push(one.entry);
  return { rules, warnings, failures };
};

/**
 * Import and validate one rule file. A broken or invalid rule is a warning,
 * never a crash.
 * @param {string} owner
 * @param {string} file
 * @param {boolean} [own]
 * @returns {Promise<Loaded>}
 */
export const loadRuleFile = async (owner, file, own = false) => {
  try {
    return entryOf(owner, file, await import(pathToFileURL(file).href));
  } catch (e) {
    return loadFailed(owner, file, e, own);
  }
};

/**
 * `loadRuleFile` without waiting.
 * @param {string} owner
 * @param {string} file
 * @param {boolean} [own]
 * @returns {Loaded}
 */
export const loadRuleFileSync = (owner, file, own = false) => {
  try {
    return entryOf(owner, file, /** @type {{ default?: unknown }} */ (require(file)));
  } catch (e) {
    return loadFailed(owner, file, e, own);
  }
};

/**
 * Load every source once (the first owner of a file wins). A host names the
 * project model its rules read as `M`. `failures` are the warnings of light's
 * own rules, which fail the run.
 * @template {ProjectModel} [M=ProjectModel]
 * @param {RuleSource[]} sources
 * @returns {Promise<{ rules: RuleEntry<M>[], warnings: string[], failures: string[] }>}
 */
export const loadRules = async (sources) => collect(await Promise.all(unique(sources).map(({ owner, file, own }) => loadRuleFile(owner, file, own))));

/**
 * `loadRules` without waiting.
 * @template {ProjectModel} [M=ProjectModel]
 * @param {RuleSource[]} sources
 * @returns {{ rules: RuleEntry<M>[], warnings: string[], failures: string[] }}
 */
export const loadRulesSync = (sources) => collect(unique(sources).map(({ owner, file, own }) => loadRuleFileSync(owner, file, own)));
