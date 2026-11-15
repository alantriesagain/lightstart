/* eslint-disable light/no-non-jsdoc-comments */
// node-only
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const repo = resolve(import.meta.dirname, "..", "..", "..");
const fixtures = resolve(import.meta.dirname, "fixtures");
const lightBin = join(repo, "packages", "light", "bin", "light.js");

/**
 * The scoped packages a fixture finds light's commands and the native extensions through.
 * @param {string} dir
 */
const linkPackages = (dir) => {
  const scope = join(dir, "node_modules", "@lightstart");
  mkdirSync(scope, { recursive: true });
  for (const name of ["light", "native", "build", "cli"]) symlinkSync(join(repo, "packages", name), join(scope, name), "dir");
};

/**
 * A copy of the fixture native app with the repository's tsc, node types and scoped packages.
 * @returns {string}
 */
const makeApp = () => {
  const app = mkdtempSync(join(tmpdir(), "native-extensions-app-"));
  cpSync(join(fixtures, "app"), app, { recursive: true });
  mkdirSync(join(app, "node_modules", "@types"), { recursive: true });
  symlinkSync(join(repo, "node_modules", "@types", "node"), join(app, "node_modules", "@types", "node"), "dir");
  mkdirSync(join(app, "node_modules", ".bin"), { recursive: true });
  const tsc = join(repo, "node_modules", ".bin", "tsc");
  writeFileSync(join(app, "node_modules", ".bin", "tsc"), '#!/bin/sh\nexec "' + tsc + '" "$@"\n', { mode: 0o755 });
  linkPackages(app);
  return app;
};

/**
 * A plain folder: no native block, just a page.
 * @returns {string}
 */
const makePlain = () => {
  const dir = mkdtempSync(join(tmpdir(), "native-extensions-plain-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "plain-fixture", type: "module" }));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>plain</title>\n");
  linkPackages(dir);
  return dir;
};

/**
 * @param {string} cwd
 * @param {string[]} args
 */
const light = (cwd, args) => {
  const result = spawnSync(process.execPath, [lightBin, ...args], { cwd, encoding: "utf8", env: { ...process.env, LIGHT_PROJECT_DIR: cwd, NO_COLOR: "1" } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

test("light build builds the fixture native project into dist/", () => {
  const app = makeApp();
  const result = light(app, ["build"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(app, "dist", "fixture-app")));
  const run = spawnSync(join(app, "dist", "fixture-app"), [], { encoding: "utf8" });
  assert.equal(run.status, 0);
  assert.match(run.stdout, /hello from fixture/);
});

test("light test runs the fixture project's tests under node and natively, and selects one", () => {
  const app = makeApp();
  const all = light(app, ["test"]);
  assert.equal(all.status, 0, all.stderr);
  assert.match(all.stdout, /PASS .*test\/hello\.test\.ts/);
  assert.match(all.stdout, /PASS .*test\/second\.test\.ts/);
  const one = light(app, ["test", "--", "second.test.ts"]);
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /PASS .*test\/second\.test\.ts/);
  assert.doesNotMatch(one.stdout, /hello\.test\.ts/);
  const nodeOnly = light(app, ["test", "--node-only"]);
  assert.equal(nodeOnly.status, 0, nodeOnly.stderr);
  assert.match(nodeOnly.stdout, /PASS .*test\/hello\.test\.ts \(node only\)/);
  assert.match(nodeOnly.stdout, /node only$/m);
});

test("light check runs the native conventions over the fixture project", () => {
  const app = makeApp();
  const result = light(app, ["check"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /✓ \./);
});

test("light build and light check leave a plain folder to light's own behaviour", () => {
  const dir = makePlain();
  const built = light(dir, ["build"]);
  assert.equal(built.status, 0, built.stderr);
  assert.ok(existsSync(join(dir, ".deployed", "current")));
  const checked = light(dir, ["check"]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /check passed/);
});
