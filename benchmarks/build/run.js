/**
 * @file The production build benchmark: `@lightstart/build`'s `build()` on `examples/todomvc` and
 * `examples/starter`, each into a fresh temporary output folder, once to warm up and then `--runs`
 * times. It reports the minimum and median wall time and the build's output size. Node only:
 * esbuild, which does the bundling, is a node program.
 *
 *   node benchmarks/build/run.js [--runs 10] [--json results.json]
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "@lightstart/build";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const EXAMPLES = path.join(ROOT, "examples");

/**
 * @param {string} name
 * @param {string | null} fallback
 */
const option = (name, fallback) => {
  const at = process.argv.indexOf("--" + name);
  return at >= 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};

const runs = Number(option("runs", "10"));
const save = option("json", null);

/**
 * One build into a temporary folder, timed around `build()` alone; the folder is removed after.
 * @param {string} root
 * @returns {Promise<{ ms: number, files: number, bytes: number }>}
 */
const once = async (root) => {
  const out = mkdtempSync(path.join(tmpdir(), "light-build-bench-"));
  try {
    const started = process.hrtime.bigint();
    const report = await build({ root, outDir: out });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const bytes = report.files.reduce((sum, file) => sum + file.bytes, 0);
    return { ms, files: report.files.length, bytes };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
};

/** @param {number[]} xs */
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const main = async () => {
  console.log(`${runs} runs per example after a warm-up, wall time of build() in ms\n`);
  console.log("| example | min ms | median ms | files | output bytes | output KB |");
  console.log("|---|---:|---:|---:|---:|---:|");
  const results = [];
  for (const name of ["todomvc", "starter"]) {
    const root = path.join(EXAMPLES, name);
    const warm = await once(root);
    const times = [];
    let last = warm;
    for (let i = 0; i < runs; i++) {
      last = await once(root);
      times.push(last.ms);
    }
    const result = { example: name, min: Math.min(...times), median: median(times), files: last.files, bytes: last.bytes, runs };
    results.push(result);
    console.log(
      `| ${name} | ${result.min.toFixed(0)} | ${result.median.toFixed(0)} | ${result.files} | ${result.bytes} | ${(result.bytes / 1024).toFixed(1)} |`,
    );
  }
  console.log("\nOutput bytes are the sum of the build report's files; the temporary output folder is not part of the timing.");

  if (save !== null) {
    writeFileSync(save, JSON.stringify({ runs, results }, null, 2) + "\n");
    console.log(`\nsaved ${save}`);
  }
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
