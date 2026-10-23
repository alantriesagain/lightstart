/**
 * @file `light-native desktop <app> [--selftest] [--no-build] [-- flags…]`: build a desktop app with light's
 * desktop shell (the shim, the backend compiled by scriptc, the page in `native.web` staged beside
 * it) into the app's dist/, then run it, logging to $NATIVE_LOG. Light's script is run by its real
 * path (this CLI's own light): it runs its main only when invoked as the file it is. With --selftest the app's `native.selftest` checks are run against the log: the backend starts
 * a turn as soon as the page connects and exits 0 once the result came back and the page saw it
 * (needs the agent's CLI on PATH and a display).
 */
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { prepare } from "../prepare.js";
import { agentEnv, capture, exec } from "../run.js";
import { LIGHT, memberByName } from "../workspace.js";
import { binaryOf } from "./build.js";

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const [name, ...rest] = args;
  if (name === undefined) throw new Error("usage: light-native desktop <app> [--selftest] [--no-build] [-- flags…]");
  const app = memberByName(root, name);
  const entry = app.config.entry;
  if (typeof entry !== "string") throw new Error(app.name + ": package.json has no native.entry");
  const binary = binaryOf(app);
  const out = join(app.dir, "dist");
  if (!rest.includes("--no-build")) {
    await prepare(root, app);
    const flags = ["build", entry, "--out", out, "--name", binary];
    if (typeof app.config.web === "string") flags.push("--web", app.config.web);
    for (const pkg of app.config.npmStatic ?? []) flags.push("--npm-static", pkg);
    const code = await exec("node", [join(LIGHT, "packages", "light", "native", "desktop", "build.js"), ...flags], { cwd: app.dir });
    if (code !== 0) throw new Error(app.name + ": the desktop build failed");
  }
  const log = process.env["NATIVE_LOG"] ?? join("/tmp", binary + ".log");
  rmSync(log, { force: true });
  const extra = rest.filter((a) => a !== "--selftest" && a !== "--no-build" && a !== "--");
  const env = agentEnv();
  if (!rest.includes("--selftest")) return exec(join(out, binary), ["--log", log, ...extra], { env });
  const r = await capture(join(out, binary), ["--selftest", "--log", log, ...extra], { env, timeoutMs: 120000 });
  process.stdout.write(r.out.split("\n").slice(-5).join("\n") + "\n");
  let status = 0;
  for (const [label, pattern] of app.config.selftest?.checks ?? [])
    if (spawnSync("grep", ["-q", "--", pattern, log]).status === 0) console.log("ok   " + label);
    else {
      console.log("FAIL " + label + " (no '" + pattern + "' in " + log + ")");
      status = 1;
    }
  if (r.code !== 0) {
    console.log("FAIL exit code " + String(r.code));
    status = 1;
  }
  console.log("log: " + log);
  return status;
};
