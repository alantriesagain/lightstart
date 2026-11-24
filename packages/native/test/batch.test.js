/* eslint-disable light/no-non-jsdoc-comments */
// node-only
// light test's batches (src/batch.js): which tests share a program, the program a batch runs, and
// a fixture app's tests run batched: passing files in one program, a failing or throwing one
// reported alone as it would be without batching, the environment put back between files, and
// --batch 1 running every file alone.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { assertFor, batchProgram, batchable, batchesOf } from "../src/batch.js";
import { TestFile } from "../src/commands/test.js";
import { findProject } from "../src/project.js";

const repo = resolve(import.meta.dirname, "..", "..", "..");
const fixtures = resolve(import.meta.dirname, "fixtures");

/** A passing test: one check, then done(). */
const passing = (name) => 'import { done, ok } from "@lightstart/light/native/assert.ts";\nconst main = async (): Promise<void> => {\n  await Promise.resolve();\n  ok("' + name + '", true);\n  done();\n};\nmain().catch((err: unknown) => {\n  console.log("FAIL " + String(err));\n  process.exit(1);\n});\n';

/**
 * A copy of the fixture app whose test/ holds `tests` (name to source), with light's assert reachable
 * as @lightstart/light, @lightstart/native's test runner and the repository's node types.
 * @param {Record<string, string>} tests
 * @returns {string}
 */
const makeApp = (tests) => {
  const app = mkdtempSync(join(tmpdir(), "native-batch-app-"));
  cpSync(join(fixtures, "app"), app, { recursive: true });
  rmSync(join(app, "test"), { recursive: true, force: true });
  mkdirSync(join(app, "test"));
  for (const [name, source] of Object.entries(tests)) writeFileSync(join(app, "test", name), source);
  mkdirSync(join(app, "node_modules", "@types"), { recursive: true });
  symlinkSync(join(repo, "node_modules", "@types", "node"), join(app, "node_modules", "@types", "node"), "dir");
  mkdirSync(join(app, "node_modules", "@lightstart"), { recursive: true });
  // light's assert for the tests, and @lightstart/native, whose cli/extend/test.ts is light test's native runner.
  symlinkSync(join(repo, "packages", "light"), join(app, "node_modules", "@lightstart", "light"), "dir");
  symlinkSync(join(repo, "packages", "native"), join(app, "node_modules", "@lightstart", "native"), "dir");
  return app;
};

/**
 * `light test` with `args` in `app`, as a user runs it: its exit code and what it printed.
 * @param {string} app
 * @param {string[]} args
 * @returns {{ code: number, out: string }}
 */
const lightTest = (app, args) => {
  const r = spawnSync(process.execPath, [join(repo, "packages", "light", "bin", "light.js"), "test", ...args], { cwd: app, encoding: "utf8" });
  return { code: r.status ?? 1, out: r.stdout + r.stderr };
};

test("batchable: a test/*.test.ts run both ways that calls done(); not a node-only one, a native-only one or one without done()", () => {
  const app = makeApp({
    "a.test.ts": passing("a"),
    "plain.test.ts": 'console.log("no tally");\n',
    "walks.test.ts": "// node-only\n" + passing("walks"),
    "shim.test.ts": "// ffi: ./ffi.json\n// native-only\n" + passing("shim"),
  });
  assert.equal(batchable(join(app, "test", "a.test.ts")), true);
  assert.equal(batchable(join(app, "test", "plain.test.ts")), false);
  assert.equal(batchable(join(app, "test", "walks.test.ts")), false);
  assert.equal(batchable(join(app, "test", "shim.test.ts")), false);
});

test("assertFor finds the assert module the member's tests reach, by its real path", () => {
  const app = makeApp({ "a.test.ts": passing("a") });
  assert.equal(assertFor(app), join(repo, "packages", "light", "native", "assert.ts"));
  assert.equal(assertFor(mkdtempSync(join(tmpdir(), "native-batch-none-"))), null);
});

test("batchesOf: a member's batchable tests with the same manifest together, at most `size`, the rest alone", () => {
  const app = makeApp({ "a.test.ts": passing("a"), "b.test.ts": passing("b"), "c.test.ts": passing("c"), "d.test.ts": passing("d"), "e.test.ts": passing("e"), "plain.test.ts": 'console.log("x");\n' });
  const member = findProject(app);
  const tests = readdirSync(join(app, "test"))
    .sort()
    .map((f) => new TestFile(member, join(app, "test", f)));
  /** @param {import("../src/batch.js").Batch[]} batches */
  const shape = (batches) => batches.map((b) => b.tests.map((t) => t.path.slice(t.path.lastIndexOf("/") + 1, -".test.ts".length)).join("+")).join(" ");
  assert.equal(shape(batchesOf(tests, 8, () => null)), "a+b+c+d+e plain");
  assert.equal(shape(batchesOf(tests, 2, () => null)), "a+b c+d e plain");
  assert.equal(shape(batchesOf(tests, 1, () => null)), "a b c d e plain");
  // A different manifest is a different program.
  assert.equal(shape(batchesOf(tests, 8, (t) => (t.path.endsWith("/c.test.ts") ? "/m.json" : null))), "a+b+d+e c plain");
});

test("batchProgram arms, imports and waits for each file in turn, then puts the environment back", () => {
  const text = batchProgram("/x/assert.ts", ["/t/a.test.ts", "/t/b.test.ts"]);
  assert.match(text, /^\/\/ Written by light test: 2 tests in one program/);
  assert.match(text, /import \{ arm \} from "\/x\/assert\.ts";/);
  const a = text.indexOf('const finished0 = arm();\nawait import("/t/a.test.ts");\nawait finished0;\nrestore();');
  const b = text.indexOf('const finished1 = arm();\nawait import("/t/b.test.ts");\nawait finished1;\nrestore();');
  assert.ok(a > 0 && b > a, text);
});

test("light test --node-only runs passing files as one program, each with its own tally", async () => {
  const app = makeApp({ "a.test.ts": passing("a"), "b.test.ts": passing("b"), "c.test.ts": passing("c") });
  const { code, out } = lightTest(app, ["--node-only", "--jobs", "1"]);
  assert.equal(code, 0, out);
  assert.match(out, /PASS app-[^/]*\/test\/a\.test\.ts|PASS [^\n]*\/test\/a\.test\.ts/);
  assert.match(out, /3 tests in \d+ s, 1 at a time, node only, 1 program\n/);
});

test("a failing file and a throwing one in a batch: the batch runs again file by file, each reported alone", async () => {
  const failing = 'import { done, eq } from "@lightstart/light/native/assert.ts";\nconst main = async (): Promise<void> => {\n  eq("one and one", String(1 + 1), "3");\n  done();\n};\nmain().catch(() => process.exit(1));\n';
  const throwing = 'import { done } from "@lightstart/light/native/assert.ts";\nconst main = async (): Promise<void> => {\n  await Promise.resolve();\n  throw new Error("boom");\n  done();\n};\nmain().catch((err: unknown) => {\n  console.log("FAIL " + (err instanceof Error ? err.message : String(err)));\n  process.exit(1);\n});\n';
  const app = makeApp({ "a.test.ts": passing("a"), "b.test.ts": failing, "c.test.ts": throwing, "d.test.ts": passing("d") });
  const { code, out } = lightTest(app, ["--node-only", "--jobs", "1"]);
  assert.equal(code, 1);
  assert.match(out, /PASS [^\n]*\/test\/a\.test\.ts \(node only\)/);
  assert.match(out, /FAIL [^\n]*\/test\/b\.test\.ts \(node=1\)\n--- node\nFAIL one and one\n  expected: "3"\n  actual:   "2"\nFAIL 0\/1\n/);
  assert.match(out, /FAIL [^\n]*\/test\/c\.test\.ts \(node=1\)\n--- node\nFAIL boom\n/);
  assert.match(out, /PASS [^\n]*\/test\/d\.test\.ts \(node only\)/);
  assert.match(out, /4 tests in \d+ s, 1 at a time, node only, 1 program \(1 batch run again file by file\)\n/);
});

test("the environment a file changed is put back before the next one", async () => {
  const sets = 'import { done, ok } from "@lightstart/light/native/assert.ts";\nprocess.env["LIGHT_BATCH_LEFT"] = "1";\nprocess.env["HOME"] = "/elsewhere";\nok("set", true);\ndone();\n';
  const reads = 'import { done, ok } from "@lightstart/light/native/assert.ts";\nok("nothing left from the file before", process.env["LIGHT_BATCH_LEFT"] === undefined && process.env["HOME"] !== "/elsewhere");\ndone();\n';
  const app = makeApp({ "a.test.ts": sets, "b.test.ts": reads });
  const { code, out } = lightTest(app, ["--node-only", "--jobs", "1"]);
  assert.equal(code, 0, out);
  assert.match(out, /2 tests in \d+ s, 1 at a time, node only, 1 program\n/);
});

test("a file that never ends: killed past --timeout, reported as timed out, the batch's other files passing alone", async () => {
  const hangs = 'import { done, ok } from "@lightstart/light/native/assert.ts";\nok("started", true);\nsetInterval(() => {}, 1000);\nawait new Promise<void>(() => {});\ndone();\n';
  const app = makeApp({ "a.test.ts": passing("a"), "b.test.ts": hangs, "c.test.ts": passing("c") });
  const { code, out } = lightTest(app, ["--node-only", "--jobs", "1", "--timeout", "2000"]);
  assert.equal(code, 1, out);
  assert.match(out, /PASS [^\n]*\/test\/a\.test\.ts \(node only\)/);
  assert.match(out, /FAIL [^\n]*\/test\/b\.test\.ts \(node=1, timed out after 2 s\)\n--- node\nok started\n/);
  assert.match(out, /PASS [^\n]*\/test\/c\.test\.ts \(node only\)/);
  assert.match(out, /3 tests in \d+ s, 1 at a time, node only, 1 program \(1 batch run again file by file\)\n/);
});

test("--batch 1 runs every file alone, as before batching", async () => {
  const app = makeApp({ "a.test.ts": passing("a"), "b.test.ts": passing("b") });
  const { code, out } = lightTest(app, ["--node-only", "--jobs", "1", "--batch", "1"]);
  assert.equal(code, 0, out);
  assert.match(out, /2 tests in \d+ s, 1 at a time, node only\n/);
});

test("natively a batch builds one program, its output the same as under node", async () => {
  const app = makeApp({ "a.test.ts": passing("a"), "b.test.ts": passing("b") });
  const { code, out } = lightTest(app, ["--jobs", "1"]);
  assert.equal(code, 0, out);
  assert.match(out, /PASS [^\n]*\/test\/a\.test\.ts\n/);
  assert.match(out, /2 tests in \d+ s, 1 at a time, dev builds, 1 program\n/);
});
