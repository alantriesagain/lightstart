/**
 * @file @lightstart/light/test/serve.js
 * A static server for a package folder with a runner page: the package and
 * the packages it declares resolve through an importmap built from their
 * `exports`, and `node:test`, `node:assert` and `node:assert/strict` resolve
 * to the shims beside this module. It runs on `@lightstart/server` (an optional
 * peer `light test` and `light serve` need): the runner page's route, and every
 * other path through the static plugin's guard and lookup, TypeScript stripped
 * as it goes out.
 */

import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { App, html, text } from "@lightstart/server";
import { serve as listen } from "@lightstart/server/node";
import { Static } from "@lightstart/server/static";
import { asPackageJson } from "../check/walk.js";
import { runnerPage } from "./page.js";

/**
 * A TypeScript module as the JavaScript a browser runs: node blanks the
 * annotations in place, so every line and column stays where it was and
 * stack traces need no source map. Node flags the call as experimental with
 * a warning, which says nothing to a test run.
 * @param {string} file
 */
const stripped = (file) => {
  const warn = process.emitWarning;
  process.emitWarning = () => {};
  try {
    return stripTypeScriptTypes(readFileSync(file, "utf8"));
  } finally {
    process.emitWarning = warn;
  }
};

/** @param {string} dir */
const manifestOf = (dir) => {
  const file = path.join(dir, "package.json");
  return existsSync(file) ? asPackageJson(JSON.parse(readFileSync(file, "utf8"))) : null;
};

/**
 * The importmap a page in `root` needs: the root package by its own name,
 * every package it declares, and the `node:` shims.
 * @param {string} root
 * @returns {{ imports: Record<string, string>, lightDir: string }}
 */
export const importmapFor = (root) => {
  /** @type {Record<string, string>} */
  const imports = {};
  const urlOf = (/** @type {string} */ dir, /** @type {string} */ file) => `/${path.relative(root, path.join(dir, file)).split(path.sep).join("/")}`;
  const map = (/** @type {string} */ dir) => {
    const pkg = manifestOf(dir);
    if (!pkg?.name) return;
    const exports = typeof pkg.exports === "object" && pkg.exports ? pkg.exports : { ".": pkg.main ?? "./index.js" };
    for (const [key, target] of Object.entries(exports)) {
      const entry = typeof target === "string" ? target : /** @type {{ default?: string }} */ (target)?.default;
      if (typeof entry !== "string") continue;
      if (key === ".") imports[pkg.name] = urlOf(dir, entry);
      else if (key === "./*") imports[`${pkg.name}/`] = dir === root ? "/" : `${urlOf(dir, "")}/`;
      else if (key.startsWith("./") && !key.includes("*")) imports[`${pkg.name}/${key.slice(2)}`] = urlOf(dir, entry);
    }
  };
  const self = manifestOf(root);
  map(root);
  for (const section of ["dependencies", "devDependencies", "peerDependencies"])
    for (const name of Object.keys(self?.[section] ?? {})) map(path.join(root, "node_modules", name));
  const lightDir = self?.name === "@lightstart/light" ? root : path.join(root, "node_modules", "@bootstrapp", "light");
  imports["node:test"] = urlOf(lightDir, "test/node-test.js");
  imports["node:assert"] = urlOf(lightDir, "test/node-assert.js");
  imports["node:assert/strict"] = urlOf(lightDir, "test/node-assert-strict.js");
  return { imports, lightDir };
};

export const RUNNER_PATH = "/__light/runner";

/**
 * Serve `root` on `port` (0 picks a free one). `RUNNER_PATH?file=<url>` is the
 * runner page for one test file; a folder answers its `index.html`.
 * @param {string} root
 * @param {number} [port]
 * @returns {Promise<{ server: import("node:http").Server, url: string }>}
 */
export const serve = async (root, port = 0) => {
  const { imports, lightDir } = importmapFor(root);
  const harnessUrl = `/${path.relative(root, path.join(lightDir, "test/harness.js")).split(path.sep).join("/")}`;
  const reportUrl = `/${path.relative(root, path.join(lightDir, "test/report.js")).split(path.sep).join("/")}`;
  const files = new Static({ root, dotfiles: true, cacheControl: "no-store" });
  const app = new App()
    .get(RUNNER_PATH, (c) => html(runnerPage({ file: c.query("file") ?? "", importmap: imports, harnessUrl, reportUrl })).header("cache-control", "no-store"))
    .get("/*", async (c) => {
      const found = await files.find(c.param("*") ?? "");
      if (found === null) return text("", 404);
      if (found.path.endsWith(".ts") && !found.path.endsWith(".d.ts")) return text(stripped(found.path)).header("content-type", "text/javascript; charset=utf-8").header("cache-control", "no-store");
      return files.reply(c, found);
    });
  const node = await listen(app, { port, host: "127.0.0.1" });
  return { server: node.server, url: `http://127.0.0.1:${node.port}` };
};

/**
 * `light serve [dir] [--port <n>]`: serve a folder the way the test runner
 * does, TypeScript stripped as it goes out, for light's examples and any page
 * that loads light's sources directly. A folder answers its `index.html`.
 * Runs until interrupted.
 * @param {string[]} args
 * @returns {Promise<number>}
 */
export const serveCommand = async (args) => {
  const at = args.indexOf("--port");
  const port = at >= 0 ? Number(args[at + 1]) : 8000;
  const dir = path.resolve(args.find((arg, i) => !arg.startsWith("--") && (at < 0 || i !== at + 1)) ?? ".");
  const { url } = await serve(dir, port);
  console.log(`serving ${dir} at ${url}`);
  return new Promise(() => {});
};
