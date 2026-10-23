/**
 * @bootstrapp/light/check/cli.js
 * `light check [dir]`: light's conventions over a project's component files.
 * The project is the nearest directory up from `dir` holding a package.json
 * (or `--root`); a `dir` inside it narrows the pass to that directory and
 * reads it as a directory of components. The rules are light's own and the
 * project's `check/rules/`. Reading a definition needs the TypeScript
 * compiler, which the project installs.
 */

import { statSync } from "node:fs";
import path from "node:path";

const USAGE = "Usage: light check [--root <dir>] [--rule <id>] [--json] [dir]";
export const TYPESCRIPT_HINT = "light check reads component definitions with TypeScript.\n  Install it where you are running from:  npm i -D typescript";
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
 * @returns {Promise<boolean>}
 */
export const check = async (argv) => {
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
    await import("typescript");
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
  const { context, sources } = openProject(root, dir);
  const { rules, warnings } = await loadRules(sources);
  const result = await runRules({ context, rules, ruleFilter: rule });
  result.configWarnings.unshift(...warnings);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return result.stats.errors === 0;
  }
  for (const warning of result.configWarnings) console.log(`[check] ${warning}`);
  for (const finding of result.findings) console.log(formatFinding(finding));
  console.log(formatSummary(result.stats));
  return result.stats.errors === 0;
};
