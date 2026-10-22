/**
 * @file The paired-probe runner: each `pairs/<id>-slow.ts` and `pairs/<id>-fast.ts`
 * is one program written two ways. Both are built with scriptc and run under
 * node and as binaries, interleaved round by round so the four runs see the
 * same machine load, after a warm-up round that is dropped. Every run must
 * print the same stdout; its last stderr line is the milliseconds it timed.
 * The report gives each variant's fastest run per engine and the fast/slow
 * ratio. Run with `node native/probes/pairs.js [--rounds N] [id …]`.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptcPath } from "../scriptc.js";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, "..", "..");
const pairsDir = join(here, "pairs");
const outDir = join(here, "out", "pairs");
const scriptc = scriptcPath(rootDir);

const args = process.argv.slice(2);
const at = args.indexOf("--rounds");
const rounds = at >= 0 ? Number(args[at + 1]) : 7;
const only = args.filter((arg, i) => !arg.startsWith("--") && (at < 0 || i !== at + 1));

/** @typedef {"slow" | "fast"} Variant */

/**
 * @param {string} cmd
 * @param {string[]} cmdArgs
 */
const run = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", cwd: rootDir, timeout: 600000 });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};

/** @param {{ stderr: string }} result @returns {number} the milliseconds the program printed last on stderr */
const timeOf = (result) => Number.parseFloat(result.stderr.trim().split("\n").at(-1) ?? "");

/** @param {number} ms */
const tenth = (ms) => Math.round(ms * 10) / 10;

const ids = [...new Set(readdirSync(pairsDir).map((file) => /^(.+)-(slow|fast)\.ts$/.exec(file)?.[1]).filter((id) => id !== undefined))]
  .filter((id) => only.length === 0 || only.includes(id))
  .sort();
if (ids.length === 0) {
  console.log("no pairs matched");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const id of ids) {
  /** @type {Record<Variant, string>} */
  const binaries = { slow: join(outDir, `${id}-slow`), fast: join(outDir, `${id}-fast`) };
  /** @type {Record<Variant, string>} */
  const sources = { slow: join(pairsDir, `${id}-slow.ts`), fast: join(pairsDir, `${id}-fast.ts`) };
  const builds = /** @type {const} */ (["slow", "fast"]).map((variant) => run(scriptc, ["build", sources[variant], "-o", binaries[variant], "--no-keep-llvm"]));
  const broken = builds.find((build) => build.code !== 0);
  if (broken) {
    failed++;
    console.log(`FAIL ${id}: scriptc build failed\n${(broken.stdout + broken.stderr).trim()}`);
    continue;
  }
  /** @type {Record<Variant, { node: number[], native: number[] }>} */
  const times = { slow: { node: [], native: [] }, fast: { node: [], native: [] } };
  /** @type {string | null} */
  let printed = null;
  /** @type {string | null} */
  let mismatch = null;
  for (let round = 0; round <= rounds && mismatch === null; round++)
    for (const variant of /** @type {const} */ (["slow", "fast"])) {
      const node = run(process.execPath, [sources[variant]]);
      const native = run(binaries[variant], []);
      if (node.code !== 0 || native.code !== 0) mismatch = `${variant}: node exit ${node.code}, native exit ${native.code}\n${node.stderr}${native.stderr}`;
      else if (node.stdout !== native.stdout) mismatch = `${variant}: node and native print different results\n--- node\n${node.stdout}--- native\n${native.stdout}`;
      else if (printed !== null && node.stdout !== printed) mismatch = `the slow and fast versions print different results\n--- slow\n${printed}--- fast\n${node.stdout}`;
      printed ??= node.stdout;
      if (mismatch !== null || round === 0) continue;
      times[variant].node.push(timeOf(node));
      times[variant].native.push(timeOf(native));
    }
  if (mismatch !== null) {
    failed++;
    console.log(`FAIL ${id}: ${mismatch}`);
    continue;
  }
  const best = (/** @type {Variant} */ variant, /** @type {"node" | "native"} */ engine) => tenth(Math.min(...times[variant][engine]));
  const line = /** @type {const} */ (["node", "native"]).map((engine) => {
    const slow = best("slow", engine);
    const fast = best("fast", engine);
    return `${engine} ${slow} -> ${fast} ms (${slow > 0 ? (fast / slow).toFixed(2) : "?"}x)`;
  });
  console.log(`${id}: ${line.join(", ")}`);
}
process.exit(failed > 0 ? 1 : 0);
