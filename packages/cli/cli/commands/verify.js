/**
 * @file `light verify`: `check`, `lint`, `typecheck` and `test` in order, each as a child of this
 * CLI so each finds the implementation for the project; a step the project declares a script for
 * runs that script. A step with neither is skipped. `--fail-fast` stops at the first failure.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "@lightstart/cli";

const STEPS = ["check", "lint", "typecheck", "test"];

/**
 * @typedef {object} StepResult
 * @property {string} step
 * @property {boolean} ok
 * @property {string} seconds
 */

/**
 * The project's package.json scripts.
 * @param {string} projectDir
 * @returns {Record<string, string>}
 */
const scriptsOf = (projectDir) => {
  try {
    const pkg = /** @type {{ scripts?: unknown }} */ (JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8")));
    if (pkg.scripts === null || typeof pkg.scripts !== "object" || Array.isArray(pkg.scripts)) return {};
    /** @type {Record<string, string>} */
    const scripts = {};
    for (const [name, line] of Object.entries(pkg.scripts)) if (typeof line === "string") scripts[name] = line;
    return scripts;
  } catch {
    return {};
  }
};

/**
 * The package manager the project's lockfile names.
 * @param {string} projectDir
 * @returns {"pnpm" | "npm"}
 */
const packageManagerOf = (projectDir) => (existsSync(join(projectDir, "pnpm-lock.yaml")) ? "pnpm" : "npm");

/**
 * Run a command with the project's folder and environment.
 * @param {string} command
 * @param {string[]} args
 * @param {string} projectDir
 * @returns {Promise<{ ok: boolean, seconds: string }>}
 */
const runProcess = (command, args, projectDir) =>
  new Promise((resolve) => {
    const started = Date.now();
    const finish = (/** @type {boolean} */ ok) => resolve({ ok, seconds: ((Date.now() - started) / 1000).toFixed(1) });
    const child = spawn(command, args, { cwd: projectDir, env: { ...process.env, LIGHT_PROJECT_DIR: projectDir }, stdio: "inherit" });
    child.on("error", () => finish(false));
    child.on("close", (code) => finish(code === 0));
  });

/**
 * Run one step: the project's script when it has one, else the same CLI's command.
 * @param {string} bin
 * @param {string} step
 * @param {string} projectDir
 * @param {string | undefined} script
 * @returns {Promise<{ ok: boolean, seconds: string }>}
 */
const runStep = (bin, step, projectDir, script) => {
  if (script !== undefined) return runProcess(packageManagerOf(projectDir), ["run", step], projectDir);
  return runProcess(process.execPath, [bin, step], projectDir);
};

export default defineCommand({
  description: "Run check, lint, typecheck and test in order",
  usage: "light verify [--fail-fast]",
  args: {
    "fail-fast": { flag: true, description: "Stop at the first failing step" },
  },
  async run(ctx, args) {
    const bin = process.argv[1];
    if (bin === undefined) {
      ctx.log.error("light verify cannot find the CLI to run its steps with");
      return 1;
    }
    const scripts = scriptsOf(ctx.projectDir);
    const available = new Set(ctx.cli.listCommands());
    /** @type {StepResult[]} */
    const results = [];
    let passed = true;
    for (const step of STEPS) {
      const script = scripts[step];
      if (script === undefined && !available.has(step)) {
        ctx.log.log(`${step}: skipped (no command)`);
        continue;
      }
      ctx.log.log(`${step}: running`);
      const result = await runStep(bin, step, ctx.projectDir, script);
      results.push({ step, ...result });
      ctx.log.log(`${step}: ${result.ok ? "pass" : "fail"} (${result.seconds}s)`);
      if (!result.ok) {
        passed = false;
        if (args["fail-fast"]) break;
      }
    }
    ctx.log.log("");
    ctx.log.log("verify summary");
    for (const result of results) ctx.log.log(`${result.step.padEnd(10)} ${result.ok ? "pass" : "fail"} ${result.seconds}s`);
    ctx.log.log(passed ? "verify: passed" : "verify: failed");
    return passed ? 0 : 1;
  },
});
