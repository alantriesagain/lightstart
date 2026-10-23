/**
 * @file scriptc's coverage, read from its JSON report (`--print=diagnostics`) rather than its
 * text: every blocker, slow path, divergence from node, untyped hot function (SC6101), deferred
 * and unreached site, with its
 * file, line, column and hint. `classify` and `gate` are pure, so a test drives them with saved
 * reports; `readCoverage` runs scriptc. The coverage gates and the probe runner share it.
 */

import { spawnSync } from "node:child_process";
import { relative } from "node:path";

/**
 * @typedef {object} Diagnostic
 * @property {string} code
 * @property {string} category
 * @property {"error" | "warning"} severity
 * @property {"preflight" | "reached" | "unreached" | "deferred"} scope
 * @property {string} file
 * @property {number} line
 * @property {number} column
 * @property {string} message
 * @property {string} hint
 * @property {string} group
 */

/**
 * @typedef {object} Envelope
 * @property {string} schema
 * @property {number} schemaVersion
 * @property {string} compilerVersion
 * @property {string} entry
 * @property {boolean} success
 * @property {{ statementsTotal: number, statementsStatic: number, statementsFailed: number, functionsSkipped: number, percentStatic: number }} [stats]
 * @property {Diagnostic[]} diagnostics
 */

/**
 * @typedef {object} Coverage
 * @property {Envelope} envelope
 * @property {Diagnostic[]} blockers code the entry reaches that does not compile
 * @property {Diagnostic[]} slowPaths code that compiles and behaves like node, but slower
 * @property {Diagnostic[]} divergences code that compiles but behaves differently from node
 * @property {Diagnostic[]} performance functions that likely run often and use untyped values (SC6101)
 * @property {Diagnostic[]} deferred JavaScript statements compiled to a throw if they run
 * @property {Diagnostic[]} unreached blockers in code the entry never reaches
 * @property {boolean} fullyStatic every analyzed statement compiles statically
 */

/**
 * The report's diagnostics sorted by kind.
 * @param {Envelope} envelope
 * @returns {Coverage}
 */
export const classify = (envelope) => {
  if (envelope.schema !== "scriptc-diagnostics" || envelope.schemaVersion !== 1)
    throw new Error(`unexpected scriptc report: schema ${envelope.schema} version ${envelope.schemaVersion}`);
  const all = envelope.diagnostics;
  const stats = envelope.stats;
  return {
    envelope,
    slowPaths: all.filter((d) => d.category === "slow-path"),
    divergences: all.filter((d) => d.category === "divergence"),
    performance: all.filter((d) => d.category === "performance"),
    deferred: all.filter((d) => d.scope === "deferred"),
    unreached: all.filter((d) => d.scope === "unreached"),
    blockers: all.filter((d) => (d.scope === "reached" || d.scope === "preflight") && d.severity === "error" && d.category !== "slow-path" && d.category !== "divergence"),
    fullyStatic: stats !== undefined && stats.statementsFailed === 0 && stats.statementsStatic === stats.statementsTotal,
  };
};

/**
 * @typedef {object} GateOptions
 * @property {boolean} [allowDynamic] deferred and unreached sites, and a statically compiled share under 100%, pass
 * @property {boolean} [allowUnreached] blockers in code the entry never reaches pass, as scriptc's own `--fail-on` lets them, and so does the share they leave uncompiled: a test compiles a slice of its packages, whose unreached code the programs that reach it answer for
 * @property {Record<string, string>} [divergences] divergence groups that pass, by group id, with the reason
 * @property {{ failed: number, deferred: number }} [baseline] counts that may go down but never up
 */

/**
 * @typedef {object} GateResult
 * @property {boolean} pass
 * @property {Diagnostic[]} failures what fails the gate, in report order
 * @property {string[]} notes what passes but should be looked at: stale allowlist entries, a baseline to lower
 */

/**
 * What fails the gate: blockers, slow paths, divergences not in the allowlist, and, unless
 * dynamic code is allowed, deferred and unreached sites. An untyped hot function (SC6101) is a
 * note: the warning guesses which functions run often, and data parsed from outside stays
 * `unknown` on purpose. With a baseline, the failed and deferred
 * counts may not grow.
 * @param {Coverage} coverage
 * @param {GateOptions} [options]
 * @returns {GateResult}
 */
export const gate = (coverage, options = {}) => {
  const allowed = options.divergences ?? {};
  /** @type {Diagnostic[]} */
  const failures = [...coverage.blockers, ...coverage.slowPaths, ...coverage.divergences.filter((d) => !(d.group in allowed))];
  if (!options.allowDynamic) failures.push(...coverage.deferred, ...(options.allowUnreached ? [] : coverage.unreached));
  /** @type {string[]} */
  const notes = [];
  const seen = new Set(coverage.divergences.map((d) => d.group));
  for (const group of Object.keys(allowed)) if (!seen.has(group)) notes.push(`divergence ${group} is allowed but no longer reported: remove it from the allowlist`);
  for (const d of coverage.performance) notes.push(`${d.code} ${d.message}`);
  let pass = failures.length === 0 && (options.allowDynamic === true || coverage.fullyStatic || (options.allowUnreached === true && coverage.unreached.length > 0));
  const failed = coverage.envelope.stats?.statementsFailed ?? 0;
  if (options.baseline) {
    if (failed > options.baseline.failed || coverage.deferred.length > options.baseline.deferred) pass = false;
    if (failed < options.baseline.failed || coverage.deferred.length < options.baseline.deferred)
      notes.push(`fewer failed (${failed}) or deferred (${coverage.deferred.length}) statements than the baseline (${options.baseline.failed}, ${options.baseline.deferred}): lower it`);
  }
  return { pass, failures, notes };
};

/**
 * One diagnostic as `file:line:col code message`, then its hint.
 * @param {Diagnostic} d
 * @param {string} root paths print relative to this directory
 */
export const formatDiagnostic = (d, root) => `${relative(root, d.file) || d.file}:${d.line}:${d.column} ${d.code} ${d.message}${d.hint ? `\n    hint: ${d.hint}` : ""}`;

/**
 * Run `scriptc coverage` with the JSON report and classify it.
 * @param {string} scriptc the compiler to run
 * @param {string} entry the program's entry, relative to `cwd`
 * @param {{ cwd: string, args?: string[], failOn?: string }} options extra arguments (an `--ffi` manifest) and the `--fail-on` level
 * @returns {Coverage & { status: number }}
 */
export const readCoverage = (scriptc, entry, options) => {
  const r = spawnSync(scriptc, ["coverage", entry, "--print=diagnostics", `--fail-on=${options.failOn ?? "slow-paths"}`, ...(options.args ?? [])], {
    encoding: "utf8",
    cwd: options.cwd,
    timeout: 600000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return parseCoverage(r.stdout ?? "", entry, r.status ?? -1, r.stderr ?? "");
};

/**
 * The report a `scriptc coverage --print=diagnostics` run printed, classified: for a caller that
 * runs scriptc itself, several at a time.
 * @param {string} stdout what the run printed on stdout
 * @param {string} entry the program's entry, for the error when there is no report
 * @param {number} status the run's exit code
 * @param {string} stderr what it printed on stderr, for that error
 * @returns {Coverage & { status: number }}
 */
export const parseCoverage = (stdout, entry, status, stderr) => {
  const start = stdout.indexOf("{");
  if (start < 0) throw new Error(`scriptc coverage ${entry} printed no report (exit ${status})\n${stderr}`);
  return { ...classify(/** @type {Envelope} */ (JSON.parse(stdout.slice(start)))), status };
};
