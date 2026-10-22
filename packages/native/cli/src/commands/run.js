/**
 * @file `light-native run <app> [--no-build] [-- flags…]`: build the app, then run it in the folder the command was
 * launched from, logging to $NATIVE_LOG (else /tmp/<binary>.log), with the environment the agents'
 * CLIs expect.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { agentEnv, exec } from "../run.js";
import { memberByName } from "../workspace.js";
import { binaryOf, binaryPath, buildApp } from "./build.js";

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const [name, ...rest] = args;
  if (name === undefined) throw new Error("usage: light-native run <app> [--no-build] [-- flags…]");
  const app = memberByName(root, name);
  const extra = rest.filter((a) => a !== "--no-build" && a !== "--");
  const binary = rest.includes("--no-build") ? binaryPath(app) : await buildApp(root, app);
  const log = process.env["NATIVE_LOG"] ?? join("/tmp", binaryOf(app) + ".log");
  rmSync(log, { force: true });
  return exec(binary, ["--dir", process.cwd(), "--log", log, ...extra], { env: agentEnv() });
};
