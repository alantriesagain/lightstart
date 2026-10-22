/**
 * @file `light-native install <app> [name]`: build the app and put it on PATH as a copy in ~/.local/bin ($BIN_DIR
 * overrides), written beside the one in use and moved over it, so a rebuild never touches the
 * binary a running session uses.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { memberByName } from "../workspace.js";
import { binaryOf, buildApp } from "./build.js";

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const [appName, name] = args;
  if (appName === undefined) throw new Error("usage: light-native install <app> [name]");
  const app = memberByName(root, appName);
  const binary = await buildApp(root, app);
  const target = name ?? binaryOf(app);
  const bin = process.env["BIN_DIR"] ?? join(homedir(), ".local", "bin");
  mkdirSync(bin, { recursive: true });
  copyFileSync(binary, join(bin, "." + target + ".new"));
  renameSync(join(bin, "." + target + ".new"), join(bin, target));
  const mb = (statSync(join(bin, target)).size / 1048576).toFixed(1);
  let version = "";
  try {
    version = execFileSync("git", ["describe", "--always", "--dirty", "--tags"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    version = "";
  }
  console.log("installed " + join(bin, target) + " (" + mb + " MB" + (version.length > 0 ? ", " + version : "") + "); run it in any folder: " + target);
  if (!(process.env["PATH"] ?? "").split(delimiter).includes(bin)) console.log("note: " + bin + " is not on PATH; add it to your shell profile");
  return 0;
};
