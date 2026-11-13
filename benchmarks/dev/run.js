/**
 * @file The dev server benchmark: the node server (`light serve` over `@lightstart/dev/node`) and
 * the native binary (`packages/dev/dist/light-serve`) serving the same fixture app, each asked for
 * the shell, a JS module with several bare imports, a 50 KB static asset and (node only) a
 * TypeScript module stripped on the way out. Every URL's body must be byte-identical between the
 * two engines before the load runs, and each case is driven with a keep-alive client for a number
 * of seconds (or requests). The report gives requests per second, p50 and p99 latency per case and
 * engine, and the native/node ratios.
 *
 *   node benchmarks/dev/run.js [--seconds 10] [--requests 20000] [--connections 32]
 *     [--warmup 300] [--no-build] [--json results.json]
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const FIXTURE = path.join(HERE, "fixture");
const NATIVE_CLI = path.join(ROOT, "packages/native/cli/bin/light-native.js");
const BINARY = path.join(ROOT, "packages/dev/dist/light-serve");
const NODE_CLI = path.join(ROOT, "packages/cli/bin/light.js");

/**
 * @param {string} name
 * @param {string | null} fallback
 */
const option = (name, fallback) => {
  const at = process.argv.indexOf("--" + name);
  return at >= 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1] : fallback;
};

const seconds = Number(option("seconds", "10"));
const requested = option("requests", null);
const requests = requested === null ? 0 : Number(requested);
const connections = Number(option("connections", "32"));
const warmup = Number(option("warmup", "300"));
const save = option("json", null);
const build = !process.argv.includes("--no-build");

/** @typedef {{ engine: string, label: string, path: string, nodeOnly?: boolean }} Case */
/** @typedef {{ requests: number, ms: number, rps: number, p50: number, p99: number }} Bench */
/** @typedef {{ url: string, close: () => Promise<void> }} Running */

/** @type {Case[]} */
const cases = [
  { engine: "shell", label: "/ (shell)", path: "/" },
  { engine: "module", label: "/main.js (bare imports)", path: "/main.js" },
  { engine: "asset", label: "/asset.txt (50 KB)", path: "/asset.txt" },
  { engine: "typescript", label: "/types.ts (stripped)", path: "/types.ts", nodeOnly: true },
];

/** @param {string} url @returns {Promise<Buffer>} */
const getBody = (url) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, { agent: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) reject(new Error(`${url} answered ${res.statusCode}`));
        else resolve(Buffer.concat(chunks));
      });
    });
    req.on("error", reject);
  });

/**
 * Start one engine on a system-chosen port and read the URL it prints.
 * @param {"node" | "native"} engine
 * @returns {Promise<Running>}
 */
const start = (engine) =>
  new Promise((resolve, reject) => {
    const cmd = engine === "node" ? process.execPath : BINARY;
    const args = engine === "node" ? [NODE_CLI, "serve", FIXTURE, "--port", "0"] : [FIXTURE, "--port", "0"];
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${engine} did not print its URL\n${output}`));
    }, 20000);
    const onData = (chunk) => {
      output += chunk;
      const found = /https?:\/\/localhost:\d+/.exec(output);
      if (found === null || settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        url: found[0],
        close: () =>
          new Promise((done) => {
            if (child.exitCode !== null) {
              done();
              return;
            }
            const kill = setTimeout(() => child.kill("SIGKILL"), 3000);
            child.once("close", () => {
              clearTimeout(kill);
              done();
            });
            child.kill("SIGTERM");
          }),
      });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      reject(new Error(`${engine} exited ${code}\n${output}`));
    });
  });

/**
 * Drive one URL with keep-alive connections for a time or a request count.
 * @param {string} url
 * @param {{ seconds?: number, requests?: number, connections: number }} options
 * @returns {Promise<Bench>}
 */
const drive = (url, options) => {
  const agent = new http.Agent({ keepAlive: true, maxSockets: options.connections });
  const latencies = [];
  const total = options.requests ?? 0;
  const deadline = Date.now() + (options.seconds ?? 0) * 1000;
  let claimed = 0;
  let failed = null;
  const startAt = process.hrtime.bigint();

  /** @returns {Promise<boolean>} whether this worker keeps going */
  const more = () => {
    if (total > 0) {
      if (claimed >= total) return false;
      claimed++;
      return true;
    }
    return Date.now() < deadline;
  };

  const request = () =>
    new Promise((resolve, reject) => {
      const sentAt = process.hrtime.bigint();
      const req = http.get(url, { agent }, (res) => {
        let bytes = 0;
        res.on("data", (chunk) => (bytes += chunk.length));
        res.on("end", () => {
          if (res.statusCode !== 200) reject(new Error(`${url} answered ${res.statusCode}`));
          else {
            latencies.push(Number(process.hrtime.bigint() - sentAt) / 1e6);
            resolve(bytes);
          }
        });
      });
      req.on("error", reject);
    });

  const worker = async () => {
    while (failed === null && more())
      try {
        await request();
      } catch (error) {
        failed = error;
      }
  };

  const workers = Array.from({ length: options.connections }, () => worker());
  return Promise.all(workers).then(() => {
    agent.destroy();
    if (failed !== null) throw failed;
    const ms = Number(process.hrtime.bigint() - startAt) / 1e6;
    latencies.sort((a, b) => a - b);
    const pct = (p) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
    return { requests: latencies.length, ms, rps: (latencies.length / ms) * 1000, p50: pct(0.5), p99: pct(0.99) };
  });
};

/**
 * Warm a case and measure it.
 * @param {string} url
 * @returns {Promise<Bench>}
 */
const measure = async (url) => {
  if (warmup > 0) await drive(url, { requests: warmup, connections });
  return drive(url, requests > 0 ? { requests, connections } : { seconds, connections });
};

const main = async () => {
  if (build) {
    const built = spawnSync(process.execPath, [NATIVE_CLI, "build", "@lightstart/dev"], { cwd: ROOT, stdio: "inherit" });
    if (built.status !== 0) throw new Error("native build failed");
  }
  if (!existsSync(BINARY)) throw new Error(`${BINARY} is missing; run without --no-build`);

  const running = { node: await start("node"), native: await start("native") };
  const size = statSync(BINARY).size;
  console.log(`binary ${path.relative(ROOT, BINARY)}, ${(size / 1e6).toFixed(2)} MB`);
  console.log(`mode ${requests > 0 ? `${requests} requests` : `${seconds} s`} per case, ${connections} connections, ${warmup} warm-up requests\n`);

  try {
    for (const c of cases) if (!c.nodeOnly) {
      const node = await getBody(running.node.url + c.path);
      const native = await getBody(running.native.url + c.path);
      if (!node.equals(native)) throw new Error(`${c.label}: node and native bodies differ (${node.length} vs ${native.length} bytes)`);
    }

    const results = [];
    for (const engine of /** @type {const} */ (["node", "native"]))
      for (const c of cases) {
        if (c.nodeOnly && engine === "native") continue;
        const bench = await measure(running[engine].url + c.path);
        results.push({ case: c.label, engine, bench });
      }

    console.log("| case | engine | req/s | p50 ms | p99 ms | native/node req/s | native/node p50 |");
    console.log("|---|---|---:|---:|---:|---:|---:|");
    for (const c of cases) {
      const node = results.find((r) => r.case === c.label && r.engine === "node");
      const native = results.find((r) => r.case === c.label && r.engine === "native");
      for (const r of [results.find((x) => x.case === c.label && x.engine === "node"), native]) {
        if (r === undefined) continue;
        const rpsRatio = node === undefined || r.engine !== "native" ? "1.00" : (r.bench.rps / node.bench.rps).toFixed(2);
        const p50Ratio = node === undefined || r.engine !== "native" ? "1.00" : (r.bench.p50 / node.bench.p50).toFixed(2);
        console.log(
          `| ${r.case} | ${r.engine} | ${Math.round(r.bench.rps)} | ${r.bench.p50.toFixed(2)} | ${r.bench.p99.toFixed(2)} | ${rpsRatio} | ${p50Ratio} |`,
        );
      }
    }
    console.log("\nA req/s ratio above 1 means native answered more requests; a p50 ratio below 1 means native answered sooner. Read the ratios, not the milliseconds.");

    if (save !== null) {
      writeFileSync(save, JSON.stringify({ seconds, requests, connections, warmup, size, results }, null, 2) + "\n");
      console.log(`\nsaved ${save}`);
    }
  } finally {
    await running.native.close();
    await running.node.close();
  }
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
