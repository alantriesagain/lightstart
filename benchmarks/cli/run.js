/**
 * @file The CLI benchmark: one small program (`packages/cli/native/light.ts`, the core with a static
 * command table) run under node and as a scriptc native binary (`packages/cli/dist/light`), plus the
 * real node CLI with command discovery (`packages/cli/bin/light.js`) as a reference. Each case runs
 * once to warm up, then `--runs` times interleaved, timing each process from spawn to exit; node's
 * and native's stdout must be byte-identical, or the run fails.
 *
 *   node benchmarks/cli/run.js [--runs 30] [--no-build] [--json results.json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const NATIVE_CLI = path.join(ROOT, "packages/native/cli/bin/light-native.js");
const SOURCE = path.join(ROOT, "packages/cli/native/light.ts");
const BINARY = path.join(ROOT, "packages/cli/dist/light");
const DISCOVERY = path.join(ROOT, "packages/cli/bin/light.js");

/**
 * @param {string} name
 * @param {string | null} fallback
 */
const option = (name, fallback) => {
  const at = process.argv.indexOf("--" + name);
  return at >= 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};

const runs = Number(option("runs", "30"));
const save = option("json", null);
const build = !process.argv.includes("--no-build");

/** @typedef {{ engine: string, cmd: string, args: string[] }} Variant */
/** @typedef {{ min: number, median: number }} Stats */

const words = Array.from({ length: 200 }, (_, i) => "w" + (i + 1));
const cases = [
  { name: "--help", args: ["--help"] },
  { name: "--version", args: ["--version"] },
  { name: "version", args: ["version"] },
  { name: "echo -u -m json a b c", args: ["echo", "-u", "-m", "json", "a", "b", "c"] },
  { name: "echo 200 words", args: ["echo", ...words] },
  { name: "discovery --help", args: ["--help"], discovery: true },
];

/**
 * @param {{ args: string[], discovery?: boolean }} c
 * @returns {Variant[]}
 */
const variants = (c) =>
  c.discovery
    ? [{ engine: "node", cmd: process.execPath, args: [DISCOVERY, ...c.args] }]
    : [
        { engine: "node", cmd: process.execPath, args: [SOURCE, ...c.args] },
        { engine: "native", cmd: BINARY, args: c.args },
      ];

/**
 * @param {string} cmd
 * @param {string[]} args
 */
const runOnce = (cmd, args) => {
  const start = process.hrtime.bigint();
  const result = spawnSync(cmd, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}`);
  return { ms, stdout: result.stdout };
};

/** @param {number[]} xs */
const min = (xs) => Math.min(...xs);
/** @param {number[]} xs */
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
/** @param {number[]} xs @returns {Stats} */
const stats = (xs) => ({ min: min(xs), median: median(xs) });

const main = () => {
  let buildMs = /** @type {number | null} */ (null);
  if (build) {
    const start = process.hrtime.bigint();
    const built = spawnSync(process.execPath, [NATIVE_CLI, "build", "@lightstart/cli"], { cwd: ROOT, stdio: "inherit" });
    buildMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (built.status !== 0) throw new Error("native build failed");
  }
  if (!existsSync(BINARY)) throw new Error(`${BINARY} is missing; run without --no-build`);

  const size = statSync(BINARY).size;
  console.log(`binary ${path.relative(ROOT, BINARY)}, ${(size / 1e6).toFixed(2)} MB`);
  if (buildMs !== null) console.log(`build ${(buildMs / 1000).toFixed(2)} s`);
  console.log(`${runs} runs per variant, medians over ms from spawn to exit\n`);

  const results = [];
  for (const c of cases) {
    const list = variants(c);
    /** @type {Map<string, number[]>} */
    const times = new Map(list.map((v) => [v.engine, []]));
    /** @type {Map<string, Buffer>} */
    const outputs = new Map();
    for (const v of list) outputs.set(v.engine, runOnce(v.cmd, v.args).stdout);
    for (let i = 0; i < runs; i++)
      for (const v of list) times.get(v.engine)?.push(runOnce(v.cmd, v.args).ms);

    const node = outputs.get("node");
    const native = outputs.get("native");
    if (node !== undefined && native !== undefined && !node.equals(native))
      throw new Error(`${c.name}: node and native stdout differ\n--- node\n${node}\n--- native\n${native}`);

    const nodeStats = stats(times.get("node") ?? []);
    const nativeTimes = times.get("native");
    const nativeStats = nativeTimes === undefined ? null : stats(nativeTimes);
    results.push({ case: c.name, node: nodeStats, native: nativeStats });
  }

  console.log("| case | node min | node median | native min | native median | node/native |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const r of results) {
    const ratio = r.native === null ? "-" : (r.node.median / r.native.median).toFixed(2);
    const native = r.native === null ? ["-", "-"] : [r.native.min.toFixed(1), r.native.median.toFixed(1)];
    console.log(`| ${r.case} | ${r.node.min.toFixed(1)} | ${r.node.median.toFixed(1)} | ${native[0]} | ${native[1]} | ${ratio} |`);
  }
  console.log("\nnode/native is the ratio of medians; a discovery row has no native counterpart.");

  if (save !== null) {
    writeFileSync(save, JSON.stringify({ runs, size, buildMs, results }, null, 2) + "\n");
    console.log(`\nsaved ${save}`);
  }
};

try {
  main();
} catch (error) {
  console.error(/** @type {Error} */ (error).message);
  process.exitCode = 1;
}
