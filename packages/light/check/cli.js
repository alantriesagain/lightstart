/**
 * @lightstart/light/check/cli.js
 * `light check [dir]`: light's conventions over a project's component files.
 * The project is the nearest directory up from `dir` holding a package.json
 * (or `--root`); a `dir` inside it narrows the pass to that directory and
 * reads it as a directory of components. The rules are light's own and the
 * project's `check/rules/`; one of light's own that fails to load fails the
 * run. Reading a definition needs the TypeScript 6 compiler API, which the
 * project installs: `typescript` 6, or `@typescript/typescript6` beside
 * TypeScript 7.
 */

import { statSync } from "node:fs";
import path from "node:path";
import { TYPESCRIPT_HINT } from "./parse/typescript-hint.js";

/** @import { RuleSource } from "./types.ts" */

export { TYPESCRIPT_HINT };

const USAGE = "Usage: light check [--root <dir>] [--rule <id>] [--json] [dir]";
/** @param {string} p */
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/**
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
  root ??= projectRoot(dir) ?? dir;
  const opened = openProject(root, dir);
  const { rules, warnings, failures } = await loadRules(sources ?? opened.sources);
  if (failures.length && !json) {
    for (const warning of failures) console.log(`[check] ${warning}`);
    return false;
  }
  const result = await runRules({ context: opened.context, rules, ruleFilter: rule });
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
