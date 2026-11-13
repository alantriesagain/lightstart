/**
 * @file @lightstart/light/test/cli.js
 * `light test <files...>`: run the given `*.test.js` files in headless
 * Chromium, served from the current package with its importmap. It runs
 * exactly the files it is given; which files those are is the caller's. With
 * no files, the groups a `cli/extend/test.ts` adds run instead.
 */

import path from "node:path";
import { runFiles } from "./run.js";
import { RUNNER_PATH, serve } from "./serve.js";

/** @import { RunnerPageOptions, TestGroup } from "../cli/extensions.ts" */
/** @import { CommandContext } from "@lightstart/cli" */

const USAGE = "Usage: light test [--headed] [--timeout <ms>] [--root <dir>] <files...>";

/**
 * The strings of a parsed rest argument.
 * @param {unknown} value
 * @returns {string[]}
 */
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

/**
 * Run the given files through light's browser runner, served from `root`.
 * @param {{ files: string[], root: string, headless?: boolean, timeoutMs?: number, render?: (options: RunnerPageOptions) => string }} options
 * @returns {Promise<boolean>}
 */
export const runTestFiles = async ({ files, root, headless = true, timeoutMs = 420000, render }) => {
  const outside = files.find((file) => !file.startsWith(root));
  if (outside) {
    console.error(`${path.relative(process.cwd(), outside)} is outside ${root}; pass --root to serve the folder that holds it`);
    return false;
  }
  const { server, url } = await serve(root, 0, render);
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

/**
 * `light test <files...>` without extensions, for the forwarder.
 * @param {string[]} argv
 * @returns {Promise<boolean>}
 */
export const test = async (argv) => {
  let headless = true;
  let timeoutMs = 420000;
  let root = process.cwd();
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
  return runTestFiles({ files, root, headless, timeoutMs });
};

/**
 * The `light test` command: the files when it is given any, otherwise the
 * groups extensions added, all of them or only those whose flags were given.
 * @param {CommandContext} ctx
 * @param {Record<string, unknown>} args
 * @returns {Promise<boolean>}
 */
export const runTestCommand = async (ctx, args) => {
  const files = strings(args.files).map((file) => path.resolve(file));
  const headless = args.headed !== true;
  const timeoutMs = typeof args.timeout === "string" && args.timeout !== "" ? Number(args.timeout) : 420000;
  const root = typeof args.root === "string" ? path.resolve(args.root) : process.cwd();
  /** @type {TestGroup[]} */
  const groups = [];
  /** @type {((options: RunnerPageOptions) => string) | undefined} */
  let render;
  const api = {
    /**
     * @param {TestGroup} group
     */
    group(group) {
      groups.push(group);
    },
    /**
     * @param {(options: RunnerPageOptions) => string} fn
     */
    runnerPage(fn) {
      render = fn;
    },
  };
  await ctx.cli.extend("test", api);
  if (files.length > 0) return runTestFiles({ files, root, headless, timeoutMs, render });
  if (groups.length === 0) {
    console.error(USAGE);
    return false;
  }
  const selected = groups.filter((group) => group.flag !== undefined && Boolean(args[group.flag]));
  const running = selected.length > 0 ? selected : groups;
  /** @type {import("../cli/extensions.ts").TestInput} */
  const input = { args, projectDir: ctx.projectDir, root, headless, timeoutMs, runFiles, serve: (dir, port = 0) => serve(dir, port, render) };
  let passed = true;
  for (const group of running)
    try {
      if (!(await group.run(input))) passed = false;
    } catch (error) {
      ctx.log.error(`${group.name}: ${error instanceof Error ? error.message : String(error)}`);
      passed = false;
    }
  return passed;
};
