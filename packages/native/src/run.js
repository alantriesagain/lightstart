/**
 * @file Processes as the commands run them: captured (stdout and stderr together, in order, for a test's
 * output or a compiler's report), inherited (a build or the app itself), a shell line (a prepare
 * step), and a pool that runs a list a few at a time while keeping the results in list order.
 */
import { spawn, spawnSync } from "node:child_process";

export class Run {
  /** @type {number} */
  code;
  /** @type {string} */
  out;
  /** @type {boolean} */
  timedOut = false;

  /**
   * @param {number} code
   * @param {string} out
   */
  constructor(code, out) {
    this.code = code;
    this.out = out;
  }
}

/**
 * Send `sig` to process `pid`; false when it is gone.
 * @param {number} pid
 * @param {NodeJS.Signals} sig
 * @returns {boolean}
 */
const signal = (pid, sig) => {
  try {
    process.kill(pid, sig);
    return true;
  } catch {
    return false;
  }
};

/**
 * Kill `pid` and every process under it (a test's own children: the binary `scriptc run` started, an
 * agent a test spawned), deepest first, on Linux and macOS alike.
 * @param {number} pid
 */
const killTree = (pid) => {
  const listed = spawnSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
  /** @type {Map<number, number[]>} */
  const children = new Map();
  for (const line of (listed.stdout ?? "").split("\n")) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    if (!Number.isFinite(child) || !Number.isFinite(parent)) continue;
    const list = children.get(parent) ?? [];
    list.push(child);
    children.set(parent, list);
  }
  /** @param {number} p */
  const kill = (p) => {
    for (const c of children.get(p) ?? []) kill(c);
    signal(p, "SIGKILL");
  };
  kill(pid);
};

/**
 * The environment the agents' CLIs expect: not inside another Claude Code session.
 * @returns {NodeJS.ProcessEnv}
 */
export const agentEnv = () => {
  const env = { ...process.env };
  delete env["CLAUDECODE"];
  delete env["CLAUDE_CODE_ENTRYPOINT"];
  return env;
};

/**
 * Run `cmd` and gather what it writes on both streams, in order. Past `timeoutMs` it is killed with
 * every process under it, and the run says it timed out.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs?: number }} [opts]
 * @returns {Promise<Run>}
 */
export const capture = (cmd, args, opts = {}) =>
  new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ["ignore", "pipe", "pipe"] });
    /** @type {Buffer[]} */
    const chunks = [];
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => chunks.push(c));
    let timedOut = false;
    const timer =
      opts.timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true;
            if (child.pid !== undefined) killTree(child.pid);
          }, opts.timeoutMs)
        : null;
    child.on("error", (error) => {
      if (timer !== null) clearTimeout(timer);
      resolvePromise(new Run(127, error.message + "\n"));
    });
    child.on("close", (code) => {
      if (timer !== null) clearTimeout(timer);
      const run = new Run(code ?? 1, Buffer.concat(chunks).toString("utf8"));
      run.timedOut = timedOut;
      resolvePromise(run);
    });
  });

/** A finished run's exit code and its two streams apart. */
export class Streams {
  /** @type {number} */
  code;
  /** @type {string} */
  stdout;
  /** @type {string} */
  stderr;

  /**
   * @param {number} code
   * @param {string} stdout
   * @param {string} stderr
   */
  constructor(code, stdout, stderr) {
    this.code = code;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * Run `cmd` to its end with its output gathered, stdout and stderr kept apart.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string }} [opts]
 * @returns {Promise<Streams>}
 */
export const captureStreams = (cmd, args, opts = {}) =>
  new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    /** @type {Buffer[]} */
    const out = [];
    /** @type {Buffer[]} */
    const err = [];
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => err.push(c));
    child.on("error", (error) => resolvePromise(new Streams(127, "", error.message + "\n")));
    child.on("close", (code) => resolvePromise(new Streams(code ?? 1, Buffer.concat(out).toString("utf8"), Buffer.concat(err).toString("utf8"))));
  });

/**
 * Run `cmd` with the terminal as its streams; answers its exit code.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<number>}
 */
export const exec = (cmd, args, opts = {}) =>
  new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: "inherit" });
    child.on("error", (error) => {
      console.error(error.message);
      resolvePromise(127);
    });
    child.on("close", (code) => resolvePromise(code ?? 1));
  });

/**
 * A shell line, the terminal as its streams.
 * @param {string} command
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<number>}
 */
export const shell = (command, opts = {}) => exec("sh", ["-c", command], opts);

/**
 * `fn` over `items`, `jobs` at a time, the results in the items' order.
 * @template T, R
 * @param {T[]} items
 * @param {number} jobs
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export const pool = async (items, jobs, fn) => {
  /** @type {R[]} */
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  const workers = [];
  for (let i = 0; i < Math.max(1, Math.min(jobs, items.length)); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
};

/**
 * A value for a single-quoted shell word.
 * @param {string} s
 * @returns {string}
 */
export const quote = (s) => "'" + s.replace(/'/g, "'\\''") + "'";
