/* eslint-disable light/no-non-jsdoc-comments */
// node-only
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { parseArgs } from "@lightstart/cli";
import coverageCommand from "../cli/commands/coverage.js";
import installCommand from "../cli/commands/install.js";
import prepareCommand from "../cli/commands/prepare.js";
import runCommand from "../cli/commands/run.js";
import selftestCommand from "../cli/commands/selftest.js";
import typecheckCommand from "../cli/commands/typecheck.js";
import { findProject } from "../src/project.js";
import { runProject as coverageProject } from "../src/commands/coverage.js";
import { runProject as runProject } from "../src/commands/run.js";
import { runProject as typecheckProject } from "../src/commands/typecheck.js";

const repo = resolve(import.meta.dirname, "..", "..", "..");
const fixtures = resolve(import.meta.dirname, "fixtures");

/**
 * @param {import("@lightstart/cli").Command} command
 * @returns {import("@lightstart/cli").ArgsSchema}
 */
const schemaOf = (command) => command.args ?? {};

test("run takes the app's arguments after --", () => {
  assert.deepEqual(parseArgs(schemaOf(runCommand), ["--", "--dir", "x"]), { appArgs: ["--dir", "x"] });
  assert.deepEqual(parseArgs(schemaOf(runCommand), []), { appArgs: [] });
});

test("selftest names a scenario, may skip the build and pass app arguments", () => {
  assert.deepEqual(parseArgs(schemaOf(selftestCommand), ["shell", "--no-build"]), { scenario: "shell", "no-build": true, appArgs: [] });
  assert.deepEqual(parseArgs(schemaOf(selftestCommand), ["shell", "--", "-v"]), { scenario: "shell", "no-build": false, appArgs: ["-v"] });
  assert.throws(() => parseArgs(schemaOf(selftestCommand), []), /Missing required positional: scenario/);
});

test("install takes an optional name and --strip", () => {
  assert.deepEqual(parseArgs(schemaOf(installCommand), []), { strip: false });
  assert.deepEqual(parseArgs(schemaOf(installCommand), ["other", "--strip"]), { name: "other", strip: true });
});

test("coverage takes --apps, --jobs and workspace members", () => {
  assert.deepEqual(parseArgs(schemaOf(coverageCommand), ["--apps", "--jobs", "2", "@lightstart/lib"]), {
    apps: true,
    jobs: "2",
    all: false,
    members: ["@lightstart/lib"],
  });
});

test("typecheck and prepare take --all and workspace members", () => {
  assert.deepEqual(parseArgs(schemaOf(typecheckCommand), ["--all"]), { all: true, members: [] });
  assert.deepEqual(parseArgs(schemaOf(typecheckCommand), ["a", "b"]), { all: false, members: ["a", "b"] });
  assert.deepEqual(parseArgs(schemaOf(prepareCommand), ["a"]), { all: false, members: ["a"] });
});

/**
 * A copy of the fixture app with the repository's tsc and node types, so the real commands run.
 * @returns {string}
 */
const makeApp = () => {
  const app = mkdtempSync(join(tmpdir(), "native-fixture-app-"));
  cpSync(join(fixtures, "app"), app, { recursive: true });
  mkdirSync(join(app, "node_modules", "@types"), { recursive: true });
  symlinkSync(join(repo, "node_modules", "@types", "node"), join(app, "node_modules", "@types", "node"), "dir");
  mkdirSync(join(app, "node_modules", ".bin"), { recursive: true });
  const tsc = join(repo, "node_modules", ".bin", "tsc");
  writeFileSync(join(app, "node_modules", ".bin", "tsc"), '#!/bin/sh\nexec "' + tsc + '" "$@"\n', { mode: 0o755 });
  return app;
};

test("light run builds the fixture app and runs it", async () => {
  const app = makeApp();
  const project = findProject(app);
  assert.equal(await runProject(project, [], app), 0);
  const result = spawnSync(join(app, "dist", "fixture-app"), [], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /hello from fixture/);
});

test("light coverage --apps covers the fixture app's entry fully statically", async () => {
  const app = makeApp();
  assert.equal(await coverageProject(findProject(app), ["--apps", "--jobs", "2"]), 0);
});

test("light typecheck checks the fixture app's tsconfig", async () => {
  const app = makeApp();
  assert.equal(await typecheckProject(findProject(app)), 0);
});
