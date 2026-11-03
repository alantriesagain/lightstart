/**
 * @file A paired CPU comparison of two server binaries: each round runs BEFORE then AFTER back to
 * back, each pinned to one core (`--server-core`, 6) with `load.mjs` on another (`--load-core`, 7),
 * and measures the server's user+system CPU per request over its warm-up and measured requests.
 * On a machine whose load moves, rounds that alternate are the only comparison that held still:
 * two identical binaries still differed by up to 9% here, so a change is judged on the medians of
 * several rounds, not one. Each binary must print `PORT <n>` to stderr and exit after
 * `POST /shutdown`, as every variant here does (build them with `run.js --engines native`, or with
 * scriptc from a copy of the package as it was before a change).
 *
 *   node benchmarks/server/pair.js <before> <after> [--workload hello-get] [--rounds 7]
 *     [--requests 40000] [--server-core 6] [--load-core 7]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} name
 * @param {string} fallback
 */
const option = (name, fallback) => {
  const at = process.argv.indexOf("--" + name);
  return at >= 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};

const [before, after] = process.argv.slice(2).filter((arg, index, all) => !arg.startsWith("--") && !(index > 0 && all[index - 1].startsWith("--")));
if (before === undefined || after === undefined) {
  console.error("usage: node benchmarks/server/pair.js <before> <after> [--workload hello-get] [--rounds 7]");
  process.exit(2);
}
const workload = option("workload", "hello-get");
const rounds = Number(option("rounds", "7"));
const measured = Number(option("requests", "40000"));
const warmup = 4000;
const serverCore = option("server-core", "6");
const loadCore = option("load-core", "7");
const scratch = mkdtempSync(path.join(os.tmpdir(), "light-pair-"));

/**
 * The server's CPU microseconds per request for one run of `binary`.
 * @param {string} binary
 * @returns {Promise<number>}
 */
const cpuOf = (binary) =>
  new Promise((resolve, reject) => {
    const timeFile = path.join(scratch, "time");
    const server = spawn("/usr/bin/time", ["-f", "%U %S", "-o", timeFile, "taskset", "-c", serverCore, path.resolve(binary)], { stdio: ["ignore", "ignore", "pipe"] });
    let errors = "";
    let started = false;
    server.stderr.on("data", (chunk) => {
      errors += chunk;
      const port = /PORT (\d+)/.exec(errors);
      if (port === null || started) return;
      started = true;
      const args = [path.join(HERE, "load.mjs"), `--port=${port[1]}`, "--connections=64", "--threads=2", `--warmup=${warmup}`, `--requests=${measured}`, `--workload=${workload}`];
      spawn("taskset", ["-c", loadCore, process.execPath, ...args], { stdio: "ignore" }).on("close", (code) => {
        if (code !== 0) reject(new Error(`${binary}: the load client exited ${code}`));
      });
    });
    server.on("close", (code) => {
      if (code !== 0) return reject(new Error(`${binary}: exited ${code}\n${errors}`));
      const [user, system] = readFileSync(timeFile, "utf8").trim().split(/\s+/).map(Number);
      resolve(((user + system) * 1e6) / (measured + warmup));
    });
  });

/** @param {number[]} values */
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const main = async () => {
  console.log(`${workload}, ${rounds} rounds, CPU µs a request (load average ${os.loadavg()[0].toFixed(2)})`);
  /** @type {number[]} */
  const a = [];
  /** @type {number[]} */
  const b = [];
  for (let round = 1; round <= rounds; round++) {
    a.push(await cpuOf(before));
    b.push(await cpuOf(after));
    console.log(`round ${round}: before ${a.at(-1)?.toFixed(2)}  after ${b.at(-1)?.toFixed(2)}`);
  }
  const mb = median(a);
  const ma = median(b);
  const lower = b.filter((value, index) => value < a[index]).length;
  console.log(`median before ${mb.toFixed(2)}  after ${ma.toFixed(2)}  (${(((ma - mb) / mb) * 100).toFixed(1)}%, after lower in ${lower} of ${rounds} rounds; load average ${os.loadavg()[0].toFixed(2)})`);
  rmSync(scratch, { recursive: true, force: true });
};

await main();
