/**
 * @file `light-native selftest <app> <scenario> [--no-build] [-- flags…]`: the app built, then run in a
 * pseudo-terminal (200x40) on a temp git repository with `--trust --selftest <scenario>`, its log
 * checked for the lines the scenario expects. A scenario is an entry of the app's `native.selftests`:
 * `args` (flags for the app; a path that exists relative to the app is made absolute), `home` (files
 * of a temp folder the app takes as its own through the `homeEnv` variable; an object is written as
 * JSON), `live` (the agent it talks to: run only with NATIVE_LIVE=1), `wait` (seconds, 40 by default),
 * `checks` ([label, grep pattern] pairs), `noProcessLeft` (a pgrep pattern that must find nothing
 * once the app exited), `exitCode` (the code the app ends with, 0 by default). The terminal is
 * util-linux `script` under `timeout` on Linux and BSD `script` under a timer on macOS.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentEnv, quote } from "../run.js";
import { Member, memberByName } from "../workspace.js";
import { binaryOf, binaryPath, buildApp } from "./build.js";

const makeRepo = () => {
  const repo = mkdtempSync(join(tmpdir(), "native-selftest-"));
  /** @param {string[]} a */
  const git = (...a) => spawnSync("git", a, { cwd: repo, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  mkdirSync(join(repo, "src"));
  mkdirSync(join(repo, "lib"));
  let app = "";
  for (let i = 1; i <= 30; i++) app += "const line" + String(i) + " = " + String(i) + ";\n";
  writeFileSync(join(repo, "src", "app.js"), app);
  writeFileSync(join(repo, "README.md"), "# Demo\n");
  writeFileSync(join(repo, "lib", "util.js"), "export const util = 1;\n");
  git("add", ".");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  writeFileSync(join(repo, "src", "app.js"), app.replace("const line3 = 3;", "const line3 = 33;").replace("const line20 = 20;", "const line20 = 200;"));
  writeFileSync(join(repo, "notes.md"), "notes\n");
  return repo;
};

/**
 * `value` with every string that names a file of `app` made absolute.
 * @param {Member} app
 * @param {unknown} value
 * @returns {unknown}
 */
const absolute = (app, value) => {
  if (typeof value === "string") return value.length > 0 && !value.startsWith("-") && existsSync(join(app.dir, value)) ? join(app.dir, value) : value;
  if (Array.isArray(value)) return value.map((v) => absolute(app, v));
  if (typeof value === "object" && value !== null) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = absolute(app, v);
    return out;
  }
  return value;
};

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const [name, scenario, ...rest] = args;
  if (name === undefined || scenario === undefined) throw new Error("usage: light-native selftest <app> <scenario> [--no-build] [-- flags…]");
  const app = memberByName(root, name);
  const scenarios = app.config.selftests ?? {};
  const cfg = scenarios[scenario];
  if (cfg === undefined) throw new Error(app.name + ": no selftest scenario " + scenario + " (" + Object.keys(scenarios).join(", ") + ")");
  if (typeof cfg.live === "string" && process.env["NATIVE_LIVE"] !== "1") {
    console.log("skip " + scenario + " (set NATIVE_LIVE=1 to talk to " + cfg.live + ")");
    return 0;
  }
  const extra = rest.filter((a) => a !== "--no-build" && a !== "--");
  const binary = rest.includes("--no-build") ? binaryPath(app) : await buildApp(root, app);
  const log = process.env["NATIVE_LOG"] ?? join(tmpdir(), binaryOf(app) + "-selftest-" + String(process.pid) + ".log");
  rmSync(log, { force: true });
  const repo = makeRepo();
  const env = agentEnv();
  /** @type {string | null} */
  let home = null;
  if (cfg.home !== undefined) {
    if (typeof cfg.homeEnv !== "string") throw new Error(app.name + ": selftest " + scenario + " has a home but no homeEnv");
    home = mkdtempSync(join(tmpdir(), "native-selftest-home-"));
    for (const [file, content] of Object.entries(/** @type {Record<string, unknown>} */ (absolute(app, cfg.home)))) {
      mkdirSync(join(home, file, ".."), { recursive: true });
      writeFileSync(join(home, file), typeof content === "string" ? content : JSON.stringify(content) + "\n");
    }
    env[cfg.homeEnv] = home;
  }
  const wait = Number(cfg.wait ?? (typeof cfg.live === "string" ? 150 : 40));
  const flags = [.../** @type {string[]} */ (absolute(app, cfg.args ?? [])), ...extra];
  const line = ["stty cols 200 rows 40;", quote(binary), "--dir", quote(repo), "--trust", "--selftest", quote(scenario), "--log", quote(log), ...flags.map(quote)].join(" ");
  const code = await new Promise((resolvePromise) => {
    const darwin = process.platform === "darwin";
    const child = darwin
      ? spawn("script", ["-q", "/dev/null", "sh", "-c", line], { env, stdio: ["pipe", "ignore", "ignore"] })
      : spawn("timeout", [String(wait), "script", "-q", "-e", "-c", line, "/dev/null"], { env, stdio: ["pipe", "ignore", "ignore"] });
    const timer = darwin ? setTimeout(() => child.kill("SIGTERM"), wait * 1000) : null;
    child.on("error", () => resolvePromise(127));
    child.on("close", (c) => {
      if (timer !== null) clearTimeout(timer);
      resolvePromise(c ?? 1);
    });
  });
  let status = 0;
  for (const [label, pattern] of cfg.checks ?? [])
    if (spawnSync("grep", ["-q", "--", pattern, log]).status === 0) console.log("ok   " + label);
    else {
      console.log("FAIL " + label + " (no '" + pattern + "' in " + log + ")");
      status = 1;
    }
  if (typeof cfg.noProcessLeft === "string") {
    await new Promise((r) => setTimeout(r, 1000));
    const left = spawnSync("pgrep", [process.platform === "darwin" ? "-lf" : "-af", "--", cfg.noProcessLeft], { encoding: "utf8" });
    if (left.status === 0) {
      console.log("FAIL a process is left: " + left.stdout.trim());
      status = 1;
    } else console.log("ok   no process left");
  }
  const expected = Number(cfg.exitCode ?? 0);
  if (code !== expected) {
    console.log("FAIL exit code " + String(code) + (expected !== 0 ? " (expected " + String(expected) + ")" : ""));
    status = 1;
  } else if (expected !== 0) console.log("ok   exit code " + String(code));
  console.log("log: " + log);
  rmSync(repo, { recursive: true, force: true });
  if (home !== null) rmSync(home, { recursive: true, force: true });
  return status;
};
