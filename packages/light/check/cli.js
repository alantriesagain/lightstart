/**
 * @lightstart/light/check/cli.js
 * `light check [dirs...]`: light's conventions over a project's component files.
 * The project is the nearest directory up from a target holding a package.json
 * (or `--root`); a target inside it narrows the pass to that directory and
 * reads it as a directory of components. The rules are light's own and the
 * project's `check/rules/`; one of light's own that fails to load fails the
 * run. Reading a definition needs the TypeScript 6 compiler API, which the
 * project installs: `typescript` 6, or `@typescript/typescript6` beside
 * TypeScript 7.
 */

import { statSync } from "node:fs";
import path from "node:path";
import { TYPESCRIPT_HINT } from "./parse/typescript-hint.js";

/** @import { ProjectContext, RuleSource } from "./types.ts" */

export { TYPESCRIPT_HINT };

const USAGE = "Usage: light check [--root <dir>] [--rule <id>] [--json] [dirs...]";

/** @param {string} p */
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/**
 * The information a context wrapper receives about the pass it is wrapping.
 * @typedef {{ dir: string, root: string, rule?: string, json: boolean }} CheckInfo
 */

/**
 * Check one directory. `sources`, when given, replaces the project's own;
 * `extraSources` is added beside them. Each `wraps` entry wraps the context
 * a rule reads, in order.
 * @param {{
 *   dir: string,
 *   root?: string | null,
 *   rule?: string,
 *   json?: boolean,
 *   sources?: RuleSource[],
 *   extraSources?: RuleSource[],
 *   sourceWraps?: Array<(sources: RuleSource[]) => RuleSource[]>,
 *   wraps?: Array<(context: ProjectContext, info: CheckInfo) => ProjectContext>,
 * }} input
 * @returns {Promise<boolean>}
 */
export const checkTarget = async ({ dir, root = null, rule, json = false, sources, extraSources = [], sourceWraps = [], wraps = [] }) => {
  if (!isDir(dir)) {
    console.error(`${path.relative(process.cwd(), dir) || "."} is not a directory\n${USAGE}`);
    return false;
  }
  try {
    await import("./parse/typescript.js");
  } catch {
    console.error(TYPESCRIPT_HINT);
    return false;
  }
  const [{ runRules }, { loadRules }, { formatFinding, formatSummary }, { openProject, projectRoot }] = await Promise.all([
    import("./engine.js"),
    import("./discover.js"),
    import("./format.js"),
    import("./project.js"),
  ]);
  const projectDir = root ?? projectRoot(dir) ?? dir;
  const opened = openProject(projectDir, dir);
  /** @type {CheckInfo} */
  const info = { dir, root: projectDir, rule, json };
  let context = opened.context;
  for (const wrap of wraps) context = wrap(context, info);
  let loadedSources = sources ?? [...opened.sources, ...extraSources];
  for (const wrap of sourceWraps) loadedSources = wrap(loadedSources);
  const { rules, warnings, failures } = await loadRules(loadedSources);
  if (failures.length && !json) {
    for (const warning of failures) console.log(`[check] ${warning}`);
    return false;
  }
  const result = await runRules({ context, rules, ruleFilter: rule });
  result.configWarnings.unshift(...warnings);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return failures.length ? false : result.stats.errors === 0;
  }
  for (const warning of result.configWarnings) console.log(`[check] ${warning}`);
  for (const finding of result.findings) console.log(formatFinding(finding));
  console.log(formatSummary(result.stats));
  return result.stats.errors === 0;
};

/**
 * `light check [dir]`: parse argv and check the directory, with light's own
 * engine. `sources`, when given, replaces the project's own rules.
 * @param {string[]} argv
 * @param {RuleSource[]} [sources]
 * @returns {Promise<boolean>}
 */
export const check = async (argv, sources) => {
  /** @type {string | null} */
  let root = null;
  /** @type {string | undefined} */
  let rule;
  let json = false;
  let dir = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root") root = path.resolve(argv[++i] ?? "");
    else if (arg === "--rule") rule = argv[++i];
    else if (arg === "--json") json = true;
    else if (arg.startsWith("-")) { console.error(USAGE); return false; }
    else dir = path.resolve(arg);
  }
  return checkTarget({ dir, root, rule, json, sources });
};
