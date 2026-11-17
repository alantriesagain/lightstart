/**
 * @file `light typecheck`: `tsc --noEmit` over the project's `tsconfig.json`, with the TypeScript
 * the project installs, or the one beside light. An error outside the project (a linked package)
 * is printed but does not fail it, as a dependency's problem belongs to that dependency.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * The package's `bin` script, from a JSON package file.
 * @param {string} file
 * @param {string} name
 * @returns {string | null}
 */
const binOf = (file, name) => {
  try {
    const pkg = /** @type {{ bin?: string | Record<string, string> }} */ (JSON.parse(readFileSync(file, "utf8")));
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[name];
    return typeof bin === "string" ? path.resolve(path.dirname(file), bin) : null;
  } catch {
    return null;
  }
};

/**
 * The tsc script reachable from `dir`, or null.
 * @param {string} dir
 * @returns {string | null}
 */
const tscIn = (dir) => {
  try {
    const require = createRequire(path.join(dir, "package.json"));
    return binOf(require.resolve("typescript/package.json"), "tsc");
  } catch {
    return null;
  }
};

/**
 * tsc's script: the project's own, else the one beside light.
 * @param {string} projectDir
 * @returns {string | null}
 */
export const tscPath = (projectDir) => tscIn(projectDir) ?? tscIn(HERE);

/**
 * tsc's lines split into the project's own errors and the others'.
 * @param {string} output
 * @param {string} projectDir
 * @returns {{ own: string[], foreign: string[] }}
 */
export const attribute = (output, projectDir) => {
  /** @type {string[]} */
  const own = [];
  /** @type {string[]} */
  const foreign = [];
  for (const line of output.split("\n")) {
    if (line.trim().length === 0) continue;
    const match = /^(.+?)\(\d+,\d+\): error TS\d+: /.exec(line);
    if (match === null) {
      own.push(line);
      continue;
    }
    const file = path.resolve(projectDir, match[1] ?? "");
    const relative = path.relative(projectDir, file);
    const inside = relative !== "" && !relative.startsWith("..") && !file.includes(`${path.sep}node_modules${path.sep}`);
    (inside ? own : foreign).push(line);
  }
  return { own, foreign };
};

/**
 * Run tsc over `projectDir`; answers the exit code.
 * @param {string} projectDir
 * @param {{ log?: { error(message: string): void, warn?(message: string): void } }} [options]
 * @returns {Promise<number>}
 */
export const typecheckProject = async (projectDir, options = {}) => {
  const tsc = tscPath(projectDir);
  if (tsc === null) {
    options.log?.error("light typecheck needs typescript: install it with\n  npm i -D typescript");
    return 1;
  }
  if (!existsSync(path.join(projectDir, "tsconfig.json"))) {
    options.log?.error(`light typecheck needs a tsconfig.json in ${projectDir}`);
    return 1;
  }
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [tsc, "--noEmit", "-p", "tsconfig.json", "--pretty", "false"], { cwd: projectDir, env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.stderr.on("data", (chunk) => (output += chunk.toString()));
    child.on("error", (error) => {
      options.log?.error(`light typecheck could not start tsc: ${error.message}`);
      resolve(1);
    });
    child.on("close", (code) => {
      const { own, foreign } = attribute(output, projectDir);
      if (own.length > 0) {
        for (const line of own) options.log?.error(line);
        resolve(code === 0 ? 1 : code);
        return;
      }
      if (foreign.length > 0) options.log?.warn?.(`${String(foreign.length)} error${foreign.length === 1 ? "" : "s"} outside ${projectDir} (ignored)`);
      resolve(0);
    });
  });
};
