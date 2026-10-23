/**
 * @file The native gate: scriptc's coverage of an entry (native/tui/index.ts by default), read from its
 * JSON report. It fails on a blocker, a slow path (a write that makes methods replaceable, so every
 * call dispatches dynamically), and a divergence from node not listed with its reason in
 * `divergences.json`; unless `--allow-dynamic` says the entry's graph holds JSDoc-typed JavaScript,
 * also on any statement deferred to a runtime throw and on a statically compiled share under 100%.
 * An entry listed in `coverage-baseline.json` may not gain failed or deferred statements;
 * `--update-baseline` records the current counts. Every finding prints with its file, line, column
 * and hint. Run with `node native/coverage.js [entry] [--allow-dynamic] [--update-baseline] [--scriptc <path>]`; a named
 * entry is relative to the working directory and keys its baseline as written.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatDiagnostic, gate, readCoverage } from "./diagnostics.js";
import { scriptcPath } from "./scriptc.js";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, "..");
const DIVERGENCES = join(here, "divergences.json");
const BASELINE = join(here, "coverage-baseline.json");

const args = process.argv.slice(2);
const at = args.indexOf("--scriptc");
const scriptc = at >= 0 ? args[at + 1] : scriptcPath(rootDir);
const allowDynamic = args.includes("--allow-dynamic");
const updateBaseline = args.includes("--update-baseline");
const named = args.find((arg, i) => !arg.startsWith("--") && (at < 0 || i !== at + 1));
const entry = named ?? "native/tui/index.ts";

/** @param {string} file */
const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});

const baselines = /** @type {Record<string, { failed: number, deferred: number }>} */ (readJson(BASELINE));
const coverage = readCoverage(scriptc, named === undefined ? entry : relative(rootDir, resolve(named)), { cwd: rootDir });
const stats = coverage.envelope.stats;
const result = gate(coverage, { allowDynamic, divergences: /** @type {Record<string, string>} */ (readJson(DIVERGENCES)), baseline: updateBaseline ? undefined : baselines[entry] });

if (updateBaseline) {
  baselines[entry] = { failed: stats?.statementsFailed ?? 0, deferred: coverage.deferred.length };
  writeFileSync(BASELINE, `${JSON.stringify(baselines, null, 2)}\n`);
  console.log(`${entry}: baseline recorded, ${baselines[entry].failed} failed and ${baselines[entry].deferred} deferred statements`);
}

for (const d of result.failures) console.log(formatDiagnostic(d, rootDir));
for (const note of result.notes) console.log(`note: ${note}`);

const share = stats ? `${stats.statementsStatic} of ${stats.statementsTotal} statements (${stats.percentStatic}%) static` : "static share unknown";
if (result.pass) {
  console.log(coverage.fullyStatic ? `${entry}: fully static, ${stats?.statementsTotal ?? "?"} statements, nothing deferred` : `${entry}: no blocker, no slow path and no divergence, ${share}`);
  process.exit(0);
}
const counts = [
  [coverage.blockers.length, "blockers"],
  [coverage.slowPaths.length, "slow paths"],
  [result.failures.filter((d) => d.category === "divergence").length, "divergences not in divergences.json"],
  [allowDynamic ? 0 : coverage.deferred.length, "deferred statements"],
  [allowDynamic ? 0 : coverage.unreached.length, "unreached blockers"],
].filter(([count]) => Number(count) > 0);
console.log(`${entry}: ${counts.length ? counts.map(([count, what]) => `${count} ${what}`).join(", ") : "more failed or deferred statements than the baseline, or not fully static"}; ${share}`);
process.exit(1);
