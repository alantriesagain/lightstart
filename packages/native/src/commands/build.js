/**
 * @file `light build`: the app's prepare steps, then scriptc builds its entry (`native.entry`, with the
 * FFI manifests `native.ffi` names) into the app's dist/. The symbol table is kept unless `--strip` asks for it,
 * so a crash's backtrace can name functions.
 */
import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolveAppFfi } from "../ffi.js";
import { prepare, prepareProject } from "../prepare.js";
import { exec } from "../run.js";
import { scriptcPath } from "@lightstart/light/native/scriptc.js";
import { Member, memberByName } from "../workspace.js";

/**
 * The binary's name: `native.binary`, else the app's folder name.
 * @param {Member} app
 * @returns {string}
 */
export const binaryOf = (app) => String(app.config.binary ?? basename(app.dir));

/**
 * The binary's path inside the app's dist/.
 * @param {Member} app
 * @returns {string}
 */
export const binaryPath = (app) => join(app.dir, "dist", binaryOf(app));

/**
 * The dev binary's path inside the app's dist/dev/.
 * @param {Member} app
 * @returns {string}
 */
export const devBinaryPath = (app) => join(app.dir, "dist", "dev", binaryOf(app));

/**
 * @typedef {object} BuildOptions
 * @property {boolean} [strip]
 * @property {boolean} [dev]
 */

/**
 * @param {Member} app
 * @param {string} scriptc
 * @param {() => Promise<void>} before
 * @param {BuildOptions} [options]
 * @returns {Promise<string>}
 */
const buildTarget = async (app, scriptc, before, options = {}) => {
  const entry = app.config.entry;
  if (typeof entry !== "string") throw new Error(app.name + ": package.json has no native.entry");
  await before();
  const dev = options.dev === true;
  const out = dev ? devBinaryPath(app) : binaryPath(app);
  mkdirSync(dirname(out), { recursive: true });
  const flags = ["build", entry];
  const manifest = resolveAppFfi(app);
  if (manifest !== null) flags.push("--ffi", manifest);
  if (dev) flags.push("--optimization", "dev");
  flags.push("-o", out, "--no-keep-llvm");
  if (options.strip === true) flags.push("--strip");
  const code = await exec(scriptc, flags, { cwd: app.dir });
  if (code !== 0) throw new Error(app.name + ": the build failed");
  return out;
};

/**
 * Build `app`; answers the binary's path.
 * @param {string} root
 * @param {Member} app
 * @param {BuildOptions} [options]
 * @returns {Promise<string>}
 */
export const buildApp = async (root, app, options = {}) => buildTarget(app, scriptcPath(root), () => prepare(root, app, "build"), options);

/**
 * Build a project with its own compiler; answers the binary's path.
 * @param {import("../project.js").Project} project
 * @param {BuildOptions} [options]
 * @returns {Promise<string>}
 */
export const buildProject = async (project, options = {}) => buildTarget(project, scriptcPath(project.dir), () => prepareProject(project, "build"), options);

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  if (args.length === 0) throw new Error("usage: light build [--strip]");
  console.log(await buildApp(root, memberByName(root, args[0]), { strip: args.includes("--strip") }));
  return 0;
};
