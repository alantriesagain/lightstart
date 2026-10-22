/**
 * @bootstrapp/light/check/discover.js: where rules come from. A rule is one
 * file under a `check/rules/` directory, its id `<owner>/<basename>`; light's
 * own rules are owned by `light`, a project's by its name. A host adds the
 * directories of the project's dependencies. `loadRulesSync` loads the same
 * files without waiting, for a caller that cannot (an eslint rule); a rule
 * module with top-level `await` fails to load there.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateRuleShape } from "./define.js";
import { walkFiles } from "./walk.js";

/** @import { PackageJson, ProjectModel, RuleEntry, RuleSource } from "./types.ts" */

/** @typedef {{ entry: RuleEntry } | { warning: string }} Loaded */

const LIGHT_ROOT = fileURLToPath(new URL("../", import.meta.url));
/** @type {(id: string) => unknown} */
const require = createRequire(import.meta.url);

/** @param {string} dir */
export const listRuleFiles = (dir) => walkFiles(dir, { recursive: false });

/**
 * The rule files of `<dir>/check/rules`, each owned by `owner`.
 * @param {string} owner
 * @param {string} dir
 * @returns {RuleSource[]}
 */
export const ruleSources = (owner, dir) => listRuleFiles(path.join(dir, "check", "rules")).map((file) => ({ owner, file }));

/** Light's own rules. */
export const ownRuleSources = () => ruleSources("light", LIGHT_ROOT);

/**
 * The project's own rules, owned by the name after the slash.
 * @param {string} projectDir
 * @param {PackageJson | null} pkg
 */
export const projectRuleSources = (projectDir, pkg) => ruleSources(/** @type {string} */ ((pkg?.name || "project").split("/").pop()), projectDir);

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
 * @returns {Loaded}
 */
const loadFailed = (owner, file, e) => ({ warning: `rule ${ruleId(owner, file)} failed to load: ${e instanceof Error ? e.message : e}` });

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
  for (const one of loaded)
    if ("warning" in one) warnings.push(one.warning);
    else rules.push(one.entry);
  return { rules, warnings };
};

/**
 * Import and validate one rule file. A broken or invalid rule is a warning,
 * never a crash.
 * @param {string} owner
 * @param {string} file
 * @returns {Promise<Loaded>}
 */
export const loadRuleFile = async (owner, file) => {
  try {
    return entryOf(owner, file, await import(pathToFileURL(file).href));
  } catch (e) {
    return loadFailed(owner, file, e);
  }
};

/**
 * `loadRuleFile` without waiting.
 * @param {string} owner
 * @param {string} file
 * @returns {Loaded}
 */
export const loadRuleFileSync = (owner, file) => {
  try {
    return entryOf(owner, file, /** @type {{ default?: unknown }} */ (require(file)));
  } catch (e) {
    return loadFailed(owner, file, e);
  }
};

/**
 * Load every source once (the first owner of a file wins). A host names the
 * project model its rules read as `M`.
 * @template {ProjectModel} [M=ProjectModel]
 * @param {RuleSource[]} sources
 * @returns {Promise<{ rules: RuleEntry<M>[], warnings: string[] }>}
 */
export const loadRules = async (sources) => collect(await Promise.all(unique(sources).map(({ owner, file }) => loadRuleFile(owner, file))));

/**
 * `loadRules` without waiting.
 * @template {ProjectModel} [M=ProjectModel]
 * @param {RuleSource[]} sources
 * @returns {{ rules: RuleEntry<M>[], warnings: string[] }}
 */
export const loadRulesSync = (sources) => collect(unique(sources).map(({ owner, file }) => loadRuleFileSync(owner, file)));
