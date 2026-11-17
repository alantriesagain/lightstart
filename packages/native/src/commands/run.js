/**
 * @file `light run [--no-build] [-- flags…]`: build the app, then run it in the folder the command was
 * launched from, with the flags given after `--` and nothing else.
 */
import { exec } from "../run.js";
import { memberByName } from "../workspace.js";
import { binaryPath, buildApp, buildProject } from "./build.js";

/**
 * Build `project` and run it in `launchDir`; answers the app's exit code.
 * @param {import("../project.js").Project} project
 * @param {string[]} extra
 * @param {string} launchDir
 * @returns {Promise<number>}
 */
export const runProject = async (project, extra, launchDir) => {
  const binary = await buildProject(project);
  return exec(binary, extra, { cwd: launchDir });
};

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const [name, ...rest] = args;
  if (name === undefined) throw new Error("usage: light run [--no-build] [-- flags…]");
  const app = memberByName(root, name);
  const extra = rest.filter((a) => a !== "--no-build" && a !== "--");
  const binary = rest.includes("--no-build") ? binaryPath(app) : await buildApp(root, app);
  return exec(binary, extra);
};
