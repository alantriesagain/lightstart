/**
 * A/B comparison of this tree (the candidate) against a git ref (the base),
 * under node, as a native binary and in Chromium, with the two trees' runs
 * interleaved so both see the same machine load.
 *
 *   node benchmarks/ab.js --base main [--rounds 10] [--suites bench,microbench,elements,browser] [--pages rows-view,cascade] [--json out.json]
 *   node benchmarks/ab.js --base main --aa   # the base against itself: writes the noise band to benchmarks/noise.local.json
 *
 * The base is checked out in /tmp/light-ab-<sha>, outside any folder an editor
 * watches, with this tree's node_modules linked in. Native binaries are built
 * in both trees with the same scriptc (`$SCRIPTC`, as `native/scriptc.js`
 * resolves it). Each round runs every suite once per tree, in ABBA order, each
 * run a fresh process or page; a first round warms the machine and is dropped.
 * For each step the report gives the candidate/base ratio: the median of the
 * per-round ratios and the ratio of the two fastest runs. A step is faster or
 * slower when both ratios are past the noise band (from an `--aa` run, else
 * 5%); a step under 2 ms gets no verdict.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptcPath } from "../native/scriptc.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CANDIDATE = join(HERE, "..");
const NOISE_FILE = join(HERE, "noise.local.json");
const NATIVE_SUITES = { bench: "native/tui/bench.js", microbench: "native/tui/microbench.js", elements: "native/tui/elements-bench.js" };
const PAGES = ["rows-view", "rows-components", "rows-html", "rows-thunks", "cascade", "reflect"];
const DEFAULT_BAND = 0.05;
const MIN_BAND = 0.03;
const TIMER_RESOLUTION_MS = 2;

const args = process.argv.slice(2);
/** @param {string} name @param {string} fallback */
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const baseRef = option("base", "main");
const rounds = Number(option("rounds", "10"));
const suites = option("suites", [...Object.keys(NATIVE_SUITES), "browser"].join(",")).split(",");
const pages = option("pages", PAGES.join(",")).split(",");
const jsonOut = option("json", "");
const aa = args.includes("--aa");

/** @param {string} command @param {string[]} commandArgs @param {string} cwd */
const run = (command, commandArgs, cwd) => {
  const result = spawnSync(command, commandArgs, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, SCRIPTC_NO_CACHE: "1" } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} (in ${cwd}) exited ${result.status}\n${result.stderr}`);
  return result.stdout;
};

const checkoutBaseWithModules = () => {
  const sha = execFileSync("git", ["rev-parse", "--verify", `${baseRef}^{commit}`], { cwd: CANDIDATE, encoding: "utf8" }).trim();
  const dir = join(tmpdir(), `light-ab-${sha.slice(0, 12)}`);
  if (!existsSync(dir)) execFileSync("git", ["worktree", "add", "--detach", dir, sha], { cwd: CANDIDATE, stdio: "ignore" });
  if (!existsSync(join(dir, "node_modules"))) symlinkSync(join(CANDIDATE, "node_modules"), join(dir, "node_modules"));
  return { dir, sha: sha.slice(0, 12) };
};

/** `name: 12.3 ms` lines, as a map from step to milliseconds. @param {string} output */
const stepsOf = (output) =>
  new Map(
    output.split("\n").flatMap((line) => {
      const match = /^(.+?): ([\d.]+) ms/.exec(line.trim());
      return match ? [[match[1], Number(match[2])]] : [];
    }),
  );

const base = checkoutBaseWithModules();
const trees = aa ? { base: base.dir, candidate: base.dir } : { base: base.dir, candidate: CANDIDATE };
const scriptc = scriptcPath(CANDIDATE);
const out = mkdtempSync(join(tmpdir(), "light-ab-bin-"));

/** Samples per key `suite/engine/step`, per tree. @type {Map<string, { base: number[], candidate: number[] }>} */
const samples = new Map();
/** @param {string} key @param {"base" | "candidate"} tree @param {number} ms */
const record = (key, tree, ms) => {
  if (!samples.has(key)) samples.set(key, { base: [], candidate: [] });
  samples.get(key)?.[tree].push(ms);
};

/** The two trees in ABBA order for round `round`. @param {number} round @returns {("base" | "candidate")[]} */
const order = (round) => (round % 2 === 0 ? ["base", "candidate"] : ["candidate", "base"]);

const nativeSuites = suites.filter((suite) => suite in NATIVE_SUITES);
/** @type {Record<string, Record<"base" | "candidate", string>>} */
const binaries = {};
for (const suite of nativeSuites) {
  const entry = NATIVE_SUITES[/** @type {keyof typeof NATIVE_SUITES} */ (suite)];
  binaries[suite] = { base: join(out, `base-${suite}`), candidate: join(out, `candidate-${suite}`) };
  for (const tree of /** @type {const} */ (["base", "candidate"]))
    if (aa && tree === "candidate") binaries[suite].candidate = binaries[suite].base;
    else run(scriptc, ["build", entry, "-o", binaries[suite][tree], "--strip"], trees[tree]);

  console.error(`built ${suite} in both trees`);
}

for (let round = 0; round <= rounds; round++) {
  for (const suite of nativeSuites) {
    const entry = NATIVE_SUITES[/** @type {keyof typeof NATIVE_SUITES} */ (suite)];
    for (const tree of order(round)) {
      const node = stepsOf(run(process.execPath, [entry], trees[tree]));
      const native = stepsOf(run(binaries[suite][tree], [], trees[tree]));
      if (round === 0) continue;
      for (const [step, ms] of node) record(`${suite}/node/${step}`, tree, ms);
      for (const [step, ms] of native) record(`${suite}/native/${step}`, tree, ms);
    }
  }
  if (round > 0) console.error(`round ${round}/${rounds}`);
}

if (suites.includes("browser")) {
  const { chromium } = await import("playwright");
  /** @typedef {Window & { bench: { ready: boolean, steps: { name: string, measure: boolean }[], run: (index: number) => Promise<number> } }} BenchWindow */
  /** @type {Record<"base" | "candidate", import("node:http").Server>} */
  const servers = {
    base: await (await import(join(trees.base, "benchmarks", "serve.js"))).serve(),
    candidate: aa ? await (await import(join(trees.base, "benchmarks", "serve.js"))).serve() : await (await import(join(trees.candidate, "benchmarks", "serve.js"))).serve(),
  };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const name of pages)
      for (let round = 0; round <= rounds; round++)
        for (const tree of order(round)) {
          const { port } = /** @type {import("node:net").AddressInfo} */ (servers[tree].address());
          const page = await browser.newPage();
          const cdp = await page.context().newCDPSession(page);
          await cdp.send("Performance.enable");
          const taskTime = async () => {
            const { metrics } = await cdp.send("Performance.getMetrics");
            return (metrics.find((metric) => metric.name === "TaskDuration")?.value ?? 0) * 1000;
          };
          await page.goto(`http://127.0.0.1:${port}/bench/${name}.html`);
          await page.waitForFunction(() => /** @type {Partial<BenchWindow>} */ (window).bench?.ready, null, { timeout: 30000 });
          const steps = await page.evaluate(() => /** @type {BenchWindow} */ (window).bench.steps);
          for (let index = 0; index < steps.length; index++) {
            const before = await taskTime();
            await page.evaluate((at) => /** @type {BenchWindow} */ (window).bench.run(at), index);
            const cpu = (await taskTime()) - before;
            if (steps[index].measure && round > 0) record(`${name}/chromium/${steps[index].name}`, tree, cpu);
          }
          await page.close();
        }
  } finally {
    await browser.close();
    for (const server of Object.values(servers)) server.close();
  }
}

/** @param {number[]} values */
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Number.NaN;

/** @type {Record<string, number>} */
const noise = !aa && existsSync(NOISE_FILE) ? JSON.parse(readFileSync(NOISE_FILE, "utf8")).bands : {};

const report = [...samples].map(([key, { base: baseRuns, candidate }]) => {
  const ratios = candidate.map((ms, i) => ms / (baseRuns[i] ?? Number.NaN));
  const medianRatio = median(ratios);
  const minRatio = Math.min(...candidate) / Math.min(...baseRuns);
  const band = noise[key] ?? DEFAULT_BAND;
  const short = median(baseRuns) < TIMER_RESOLUTION_MS || !Number.isFinite(medianRatio) || !Number.isFinite(minRatio);
  const verdict = short ? "too short" : medianRatio < 1 - band && minRatio < 1 - band ? "faster" : medianRatio > 1 + band && minRatio > 1 + band ? "slower" : "same";
  return { key, base: median(baseRuns), candidate: median(candidate), medianRatio, minRatio, band, verdict };
});

rmSync(out, { recursive: true, force: true });

if (aa) {
  const bands = Object.fromEntries(report.filter((row) => row.verdict !== "too short").map((row) => [row.key, Math.max(MIN_BAND, Math.abs(row.medianRatio - 1), Math.abs(row.minRatio - 1))]));
  writeFileSync(NOISE_FILE, JSON.stringify({ base: base.sha, rounds, date: new Date().toISOString(), bands }, null, 2));
  console.log(`wrote the noise band for ${Object.keys(bands).length} steps to ${NOISE_FILE}`);
  for (const [key, band] of Object.entries(bands)) console.log(`${key.padEnd(58)}${`${(band * 100).toFixed(1)}%`.padStart(8)}`);
  process.exit(0);
}

const pct = (/** @type {number} */ ratio) => `${ratio >= 1 ? "+" : ""}${((ratio - 1) * 100).toFixed(1)}%`;
console.log(`\ncandidate vs ${baseRef} (${base.sha}), ${rounds} rounds; times are medians in ms (cpu for chromium)`);
console.log(`${"step".padEnd(58)}${"base".padStart(10)}${"cand".padStart(10)}${"median".padStart(9)}${"min".padStart(9)}${"band".padStart(7)}  verdict`);
for (const row of report)
  console.log(`${row.key.padEnd(58)}${row.base.toFixed(1).padStart(10)}${row.candidate.toFixed(1).padStart(10)}${pct(row.medianRatio).padStart(9)}${pct(row.minRatio).padStart(9)}${`${(row.band * 100).toFixed(0)}%`.padStart(7)}  ${row.verdict}`);
const count = (/** @type {string} */ verdict) => report.filter((row) => row.verdict === verdict).length;
console.log(`\n${count("faster")} faster, ${count("slower")} slower, ${count("same")} within the band, ${count("too short")} too short to judge`);

if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ base: baseRef, sha: base.sha, rounds, date: new Date().toISOString(), report }, null, 2));
