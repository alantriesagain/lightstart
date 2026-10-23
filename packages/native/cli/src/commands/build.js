/**
 * @file `light-native build <app>`: the app's prepare steps, then scriptc builds its entry (`native.entry`, with its
 * FFI manifest when `native.ffi` names one) into the app's dist/, stripped.
 */
import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolveFfi } from "../ffi.js";
import { prepare } from "../prepare.js";
import { exec } from "../run.js";
import { scriptcPath } from "@bootstrapp/light/native/scriptc.js";
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
 * Build `app`; answers the binary's path.
 * @param {string} root
 * @param {Member} app
 * @returns {Promise<string>}
 */
export const buildApp = async (root, app) => {
  const entry = app.config.entry;
  if (typeof entry !== "string") throw new Error(app.name + ": package.json has no native.entry");
  await prepare(root, app);
  const out = binaryPath(app);
  mkdirSync(dirname(out), { recursive: true });
  const flags = ["build", entry];
  if (typeof app.config.ffi === "string") flags.push("--ffi", resolveFfi(app, app.config.ffi));
  flags.push("-o", out, "--strip", "--no-keep-llvm");
  const code = await exec(scriptcPath(root), flags, { cwd: app.dir });
  if (code !== 0) throw new Error(app.name + ": the build failed");
  return out;
};

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  if (args.length === 0) throw new Error("usage: light-native build <app>");
  console.log(await buildApp(root, memberByName(root, args[0])));
  return 0;
};
