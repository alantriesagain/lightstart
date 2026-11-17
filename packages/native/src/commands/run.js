/**
 * @file `light run [--no-build] [--release] [-- flags…]`: build the app in scriptc's dev posture unless
 * `--release`, then run it in the folder the command was launched from, with the flags given after `--`
 * and nothing else.
 */
import { exec } from "../run.js";
import { memberByName } from "../workspace.js";
import { binaryOf, binaryPath, buildApp, buildProject, devBinaryPath } from "./build.js";

/**
 * Build `app` and say how long it took, before and after.
 * @param {import("../workspace.js").Member} app
 * @param {() => Promise<string>} build
 * @returns {Promise<string>}
 */
const buildWithFeedback = async (app, build) => {
  const name = binaryOf(app);
  process.stderr.write("building " + name + "…\n");
  const start = Date.now();
  const binary = await build();
  process.stderr.write("built " + name + " in " + ((Date.now() - start) / 1000).toFixed(1) + "s\n");
  return binary;
};

/**
 * @typedef {object} RunOptions
 * @property {boolean} [release] Build the release binary in dist/ instead of the dev binary in dist/dev/
 * @property {boolean} [noBuild] Run the binary already built, without building
 */

/**
 * Build `project` and run it in `launchDir`; answers the app's exit code.
 * @param {import("../project.js").Project} project
 * @param {string[]} extra
 * @param {string} launchDir
 * @param {RunOptions} [options]
 * @returns {Promise<number>}
 */
export const runProject = async (project, extra, launchDir, options = {}) => {
  const release = options.release === true;
  const binary = options.noBuild === true ? (release ? binaryPath(project) : devBinaryPath(project)) : await buildWithFeedback(project, () => buildProject(project, { dev: !release }));
  return exec(binary, extra, { cwd: launchDir });
};

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const [name, ...rest] = args;
  if (name === undefined) throw new Error("usage: light run [--no-build] [--release] [-- flags…]");
  const app = memberByName(root, name);
  const release = rest.includes("--release");
  const extra = rest.filter((a) => a !== "--no-build" && a !== "--release" && a !== "--");
  const binary = rest.includes("--no-build") ? (release ? binaryPath(app) : devBinaryPath(app)) : await buildWithFeedback(app, () => buildApp(root, app, { dev: !release }));
  return exec(binary, extra);
};
