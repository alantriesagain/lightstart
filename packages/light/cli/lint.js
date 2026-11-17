/**
 * @file `light lint`: eslint over a project with its own `eslint.config.js`, or light's
 * recommended config when it has none. `--fix` reaches eslint unchanged.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_NAMES = ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs"];

const IGNORES = ["node_modules/**", "dist/**", ".deployed/**", ".light/**", ".data/**"];

const NEEDED = "eslint @stylistic/eslint-plugin eslint-plugin-lit globals";

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
 * The eslint script reachable from `dir`, or null.
 * @param {string} dir
 * @returns {string | null}
 */
const eslintIn = (dir) => {
  try {
    const require = createRequire(path.join(dir, "package.json"));
    return binOf(require.resolve("eslint/package.json"), "eslint");
  } catch {
    return null;
  }
};

/**
 * eslint's script: the project's own, else the one beside light.
 * @param {string} projectDir
 * @returns {string | null}
 */
export const eslintPath = (projectDir) => eslintIn(projectDir) ?? eslintIn(HERE);

/**
 * The project's eslint config, or null.
 * @param {string} projectDir
 * @returns {string | null}
 */
const configOf = (projectDir) => {
  for (const name of CONFIG_NAMES) {
    const file = path.join(projectDir, name);
    if (existsSync(file)) return file;
  }
  return null;
};

/**
 * Run eslint over `projectDir`; answers the exit code.
 * @param {string} projectDir
 * @param {{ fix?: boolean, log?: { error(message: string): void } }} [options]
 * @returns {Promise<number>}
 */
export const lintProject = async (projectDir, options = {}) => {
  const eslint = eslintPath(projectDir);
  if (eslint === null) {
    options.log?.error(`light lint needs eslint and its config's packages: install them with\n  npm i -D ${NEEDED}`);
    return 1;
  }
  const config = configOf(projectDir);
  const args = [];
  if (config !== null) args.push("--config", config);
  else args.push("--config", path.resolve(HERE, "../eslint/recommended.js"));
  for (const pattern of IGNORES) args.push("--ignore-pattern", pattern);
  if (options.fix === true) args.push("--fix");
  args.push(".");
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [eslint, ...args], { cwd: projectDir, stdio: "inherit", env: process.env });
    child.on("error", (error) => {
      options.log?.error(`light lint could not start eslint: ${error.message}`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
};
