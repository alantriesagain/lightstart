/**
 * @file @bootstrapp/light/test/serve.js
 * A static server for a package folder with a runner page: the package and
 * the packages it declares resolve through an importmap built from their
 * `exports`, and `node:test`, `node:assert` and `node:assert/strict` resolve
 * to the shims beside this module.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { asPackageJson } from "../check/walk.js";
import { runnerPage } from "./page.js";

const TYPES = /** @type {Record<string, string>} */ ({
  ".js": "text/javascript", ".mjs": "text/javascript", ".ts": "text/javascript", ".html": "text/html", ".json": "application/json",
  ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain",
});

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
  const lightDir = self?.name === "@bootstrapp/light" ? root : path.join(root, "node_modules", "@bootstrapp", "light");
  imports["node:test"] = urlOf(lightDir, "test/node-test.js");
  imports["node:assert"] = urlOf(lightDir, "test/node-assert.js");
  imports["node:assert/strict"] = urlOf(lightDir, "test/node-assert-strict.js");
  return { imports, lightDir };
};

export const RUNNER_PATH = "/__light/runner";

/**
 * Serve `root` on `port` (0 picks a free one). `RUNNER_PATH?file=<url>` is the
 * runner page for one test file.
 * @param {string} root
 * @param {number} [port]
 * @returns {Promise<{ server: http.Server, url: string }>}
 */
export const serve = (root, port = 0) =>
  new Promise((resolve) => {
    const { imports, lightDir } = importmapFor(root);
    const harnessUrl = `/${path.relative(root, path.join(lightDir, "test/harness.js")).split(path.sep).join("/")}`;
    const reportUrl = `/${path.relative(root, path.join(lightDir, "test/report.js")).split(path.sep).join("/")}`;
    const server = http.createServer((req, res) => {
      const { pathname, searchParams } = new URL(req.url ?? "/", "http://localhost");
      if (pathname === RUNNER_PATH) {
        res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
        res.end(runnerPage({ file: searchParams.get("file") ?? "", importmap: imports, harnessUrl, reportUrl }));
        return;
      }
      const asked = path.join(root, decodeURIComponent(pathname));
      const file = existsSync(asked) && statSync(asked).isDirectory() ? path.join(asked, "index.html") : asked;
      if (!file.startsWith(root) || !existsSync(file)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(file.endsWith(".ts") && !file.endsWith(".d.ts") ? stripped(file) : readFileSync(file));
    });
    server.listen(port, "127.0.0.1", () => {
      const address = /** @type {import("node:net").AddressInfo} */ (server.address());
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });

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
