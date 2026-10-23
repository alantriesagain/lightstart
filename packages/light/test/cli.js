/**
 * @file @bootstrapp/light/test/cli.js
 * `light test <files...>`: run the given `*.test.js` files in headless
 * Chromium, served from the current package with its importmap. It runs
 * exactly the files it is given; which files those are is the caller's.
 */

import path from "node:path";
import { runFiles } from "./run.js";
import { RUNNER_PATH, serve } from "./serve.js";

const USAGE = "Usage: light test [--headed] [--timeout <ms>] [--root <dir>] <files...>";

/**
 * @param {string[]} argv
 * @returns {Promise<boolean>}
 */
export const test = async (argv) => {
  let headless = true;
  let timeoutMs = 420000;
  let root = process.cwd();
  /** @type {string[]} */
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--headed") headless = false;
    else if (arg === "--timeout") timeoutMs = Number(argv[++i]);
    else if (arg === "--root") root = path.resolve(argv[++i]);
    else if (arg.startsWith("-")) { console.error(USAGE); return false; }
    else files.push(path.resolve(arg));
  }
  if (!files.length) {
    console.error(USAGE);
    return false;
  }
  const outside = files.find((file) => !file.startsWith(root));
  if (outside) {
    console.error(`${path.relative(process.cwd(), outside)} is outside ${root}; pass --root to serve the folder that holds it`);
    return false;
  }
  const { server, url } = await serve(root);
  try {
    return await runFiles({
      files: files.map((file) => {
        const rel = path.relative(root, file).split(path.sep).join("/");
        return { label: rel, url: `/${rel}` };
      }),
      runnerUrl: (fileUrl) => `${url}${RUNNER_PATH}?file=${encodeURIComponent(fileUrl)}`,
      headless,
      timeoutMs,
    });
  } finally {
    server.close();
  }
};
