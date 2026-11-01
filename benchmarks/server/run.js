/**
 * @file The server benchmark: scriptc's http-api workload written three ways (`variants/raw.ts` on
 * bare `node:http`, `variants/bridge.ts` as a Fetch handler behind bootstrapp's node-to-Fetch
 * bridge, `variants/light.ts` on @lightstart/server), each run under node and, when a scriptc
 * builds it, as a native binary. Every round starts each contender, reads `PORT <n>` from its
 * stderr, drives it with `load.mjs` (keep-alive connections, a seeded request sequence) and waits
 * for it to print its totals and exit. Every contender must answer the same digest and print the
 * same totals as raw under node; the report gives each one's median requests per second, p50 and
 * p99 latency, and its throughput against raw under node.
 *
 *   node benchmarks/server/run.js [--rounds 3] [--engines node,native] [--variants raw,bridge,light]
 *     [--connections 64] [--requests 40000] [--cpu] [--server-core 6] [--load-core 7]
 *
 * With `--cpu`, each server is pinned to one core with `taskset` and the load client to another, and
 * the report adds the server's user+system CPU seconds, per request and per 10,000 requests (the
 * warm-up's requests counted, since the process's CPU includes them).
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scriptcPath } from "../../packages/light/native/scriptc.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(HERE, "out");

/**
 * @param {string} name
 * @param {string} fallback
 */
const option = (name, fallback) => {
  const at = process.argv.indexOf("--" + name);
  return at >= 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};

const rounds = Number(option("rounds", "3"));
const engines = option("engines", "node").split(",");
const variants = option("variants", "raw,bridge,light").split(",");
const connections = option("connections", "64");
const measured = option("requests", "40000");
const warmup = 4000;
const cpu = process.argv.includes("--cpu");
const serverCore = option("server-core", "6");
const loadCore = option("load-core", "7");
let sessions = 0;

/** @typedef {{ variant: string, engine: string, label: string, cmd: string, args: string[] }} Contender */
/** @typedef {{ rps: number, p50_ms: number, p99_ms: number, cpu: number }} Bench */

/** @returns {Contender[]} */
const contenders = () => {
  /** @type {Contender[]} */
  const out = [];
  const scriptc = engines.includes("native") ? scriptcPath(ROOT) : "";
  if (scriptc !== "") mkdirSync(OUT, { recursive: true });
  for (const variant of variants) {
    const source = path.join(HERE, "variants", variant + ".ts");
    if (engines.includes("node")) out.push({ variant, engine: "node", label: variant + " node", cmd: process.execPath, args: ["--no-warnings", source] });
    if (scriptc !== "") {
      const binary = path.join(OUT, variant);
      const built = spawnSync(scriptc, ["build", source, "-o", binary, "--no-keep-llvm"], { cwd: ROOT, encoding: "utf8" });
      if (built.status !== 0) {
        console.log(`${variant}: native build failed\n${built.stdout}${built.stderr}`);
        continue;
      }
      out.push({ variant, engine: "native", label: variant + " native", cmd: binary, args: [] });
    }
  }
  return out;
};

/**
 * Starts the server, waits for its port, drives it with the client and collects both outputs.
 * @param {Contender} c
 * @returns {Promise<{ digest: string, totals: string, bench: Bench }>}
 */
const session = (c) =>
  new Promise((resolve, reject) => {
    const timeFile = path.join(os.tmpdir(), `light-bench-${process.pid}-${sessions++}.time`);
    const server = cpu
      ? spawn("/usr/bin/time", ["-f", "%U %S", "-o", timeFile, "taskset", "-c", serverCore, c.cmd, ...c.args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] })
      : spawn(c.cmd, c.args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let totals = "";
    let errors = "";
    let started = false;
    const client = { stdout: "", stderr: "", code: /** @type {number | null} */ (null) };
    server.stdout.on("data", (chunk) => (totals += chunk));
    server.stderr.on("data", (chunk) => {
      errors += chunk;
      const port = /PORT (\d+)/.exec(errors);
      if (port === null || started) return;
      started = true;
      const loadArgs = [path.join(HERE, "load.mjs"), `--port=${port[1]}`, `--connections=${connections}`, "--threads=2", `--warmup=${warmup}`, `--requests=${measured}`];
      const load = cpu
        ? spawn("taskset", ["-c", loadCore, process.execPath, ...loadArgs], { stdio: ["ignore", "pipe", "pipe"] })
        : spawn(process.execPath, loadArgs, { stdio: ["ignore", "pipe", "pipe"] });
      load.stdout.on("data", (d) => (client.stdout += d));
      load.stderr.on("data", (d) => (client.stderr += d));
      load.on("close", (code) => (client.code = code));
    });
    const timer = setTimeout(() => {
      server.kill("SIGKILL");
      reject(new Error(`${c.label}: timed out\n${errors}`));
    }, 180000);
    server.on("close", (code) => {
      clearTimeout(timer);
      const finish = () => {
        const line = /BENCH (\{.*\})/.exec(client.stderr);
        if (code !== 0 || client.code !== 0 || line === null) return reject(new Error(`${c.label}: server ${code}, client ${client.code}\n${errors}${client.stderr}`));
        let seconds = 0;
        if (cpu) {
          const parts = readFileSync(timeFile, "utf8").trim().split(/\s+/);
          seconds = Number(parts[0]) + Number(parts[1]);
          unlinkSync(timeFile);
        }
        const bench = JSON.parse(line[1]);
        resolve({ digest: client.stdout.trim(), totals: totals.trim(), bench: { ...bench, cpu: seconds } });
      };
      if (client.code === null) setTimeout(finish, 200);
      else finish();
    });
  });

/** @param {number[]} xs */
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const main = async () => {
  const list = contenders();
  /** @type {Map<string, Bench[]>} */
  const results = new Map(list.map((c) => [c.label, []]));
  /** @type {{ digest: string, totals: string } | null} */
  let baseline = null;
  let diverged = 0;
  for (let round = 0; round < rounds; round++)
    for (const c of list) {
      const run = await session(c);
      if (baseline === null) baseline = { digest: run.digest, totals: run.totals };
      else if (run.digest !== baseline.digest || run.totals !== baseline.totals) {
        diverged++;
        console.log(`${c.label} diverged from ${list[0].label}:\n--- expected\n${baseline.digest}\n${baseline.totals}\n--- got\n${run.digest}\n${run.totals}`);
      }
      results.get(c.label)?.push(run.bench);
      process.stderr.write(`round ${round + 1}/${rounds} ${c.label}: ${run.bench.rps} req/s${cpu ? `, ${run.bench.cpu.toFixed(3)} CPU s` : ""}\n`);
    }
  const reference = results.get("raw node");
  const base = reference === undefined || reference.length === 0 ? 0 : median(reference.map((b) => b.rps));
  console.log(`\n${connections} connections, ${measured} measured requests, ${rounds} rounds, medians`);
  if (cpu) {
    console.log(`\nservers pinned to core ${serverCore}, load client to core ${loadCore}\n`);
    console.log("| contender | req/s | CPU s | CPU us/req | CPU s/10k req | p50 ms | p99 ms | vs raw node |");
    console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
  } else {
    console.log("\n| contender | req/s | p50 ms | p99 ms | vs raw node |");
    console.log("|---|---:|---:|---:|---:|");
  }
  for (const c of list) {
    const runs = results.get(c.label) ?? [];
    const rps = median(runs.map((b) => b.rps));
    const ratio = base > 0 ? (rps / base).toFixed(2) + "x" : "-";
    if (cpu) {
      const seconds = median(runs.map((b) => b.cpu));
      const served = Number(measured) + warmup;
      const perRequest = (seconds * 1e6) / served;
      const per10k = (seconds * 1e4) / served;
      console.log(`| ${c.label} | ${rps} | ${seconds.toFixed(3)} | ${perRequest.toFixed(2)} | ${per10k.toFixed(4)} | ${median(runs.map((b) => b.p50_ms))} | ${median(runs.map((b) => b.p99_ms))} | ${ratio} |`);
    } else {
      console.log(`| ${c.label} | ${rps} | ${median(runs.map((b) => b.p50_ms))} | ${median(runs.map((b) => b.p99_ms))} | ${ratio} |`);
    }
  }
  if (diverged > 0) {
    console.log(`\n${diverged} runs diverged`);
    process.exitCode = 1;
  } else console.log("\nevery run answered the same digest and totals");
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
