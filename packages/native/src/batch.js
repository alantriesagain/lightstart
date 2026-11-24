/**
 * @file Batches for `light test`: the tests that can share one program (a member's test/*.test.ts
 * with the same `// ffi:` manifest, run under node and natively, ending in `done()`) a few at a
 * time, and the program that runs a batch. It imports each test in turn, waits for that test's
 * `done()` through assert's `arm()`, and puts the environment back before the next, so a batch
 * builds once natively instead of once per file. The program is written in the member's
 * `.scriptc/light-test/` (ignored like the rest of `.scriptc/`): scriptc reads the tsconfig nearest
 * a program's entry for the whole program, so it has to sit under the member's. Its name comes from
 * the member and its files, so the same batch reuses scriptc's cache.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nativeOnly, nodeOnly } from "./ffi.js";

export class Batch {
  /** @type {import("./commands/test.js").TestFile[]} */
  tests;
  /** @type {string | null} */
  manifest;

  /**
   * @param {import("./commands/test.js").TestFile[]} tests
   * @param {string | null} manifest
   */
  constructor(tests, manifest) {
    this.tests = tests;
    this.manifest = manifest;
  }
}

/**
 * Whether the test at `path` may share a program: a test/*.test.ts run under node and natively that
 * calls `done()`, which is what the program waits for before the next test.
 * @param {string} path
 * @returns {boolean}
 */
export const batchable = (path) => path.endsWith(".test.ts") && !nodeOnly(path) && !nativeOnly(path) && /\bdone\(\)/.test(readFileSync(path, "utf8"));

/**
 * The real path of the assert module a member's tests reach (`@lightstart/light/native/assert.ts`,
 * directly or through `@lightstart/test`, or the light package's own), or null when none is found:
 * the batch program must arm the same module the tests call `done()` on.
 * @param {string} dir the member's folder
 * @returns {string | null}
 */
export const assertFor = (dir) => {
  const candidates = [
    join(dir, "node_modules", "@lightstart", "light", "native", "assert.ts"),
    join(dir, "node_modules", "@lightstart", "test", "node_modules", "@lightstart", "light", "native", "assert.ts"),
    join(dir, "native", "assert.ts"),
  ];
  for (const path of candidates) if (existsSync(path)) return realpathSync(path);
  return null;
};

/**
 * `tests` in batches of at most `size`, in their order: the batchable ones of a member with the same
 * manifest together, every other test alone. A size of 1 leaves every test alone.
 * @param {import("./commands/test.js").TestFile[]} tests
 * @param {number} size
 * @param {(test: import("./commands/test.js").TestFile) => string | null} manifestOf
 * @returns {Batch[]}
 */
export const batchesOf = (tests, size, manifestOf) => {
  /** @type {Batch[]} */
  const out = [];
  /** @type {Map<string, Batch>} */
  const open = new Map();
  for (const t of tests) {
    const manifest = manifestOf(t);
    if (size <= 1 || !batchable(t.path) || assertFor(t.member.dir) === null) {
      out.push(new Batch([t], manifest));
      continue;
    }
    const key = t.member.dir + "\n" + (manifest ?? "");
    const batch = open.get(key);
    if (batch !== undefined && batch.tests.length < size) batch.tests.push(t);
    else {
      const fresh = new Batch([t], manifest);
      open.set(key, fresh);
      out.push(fresh);
    }
  }
  return out;
};

/**
 * The program that runs `files` one after another: arm, import the test, wait for its `done()`,
 * then put back the environment the program started with.
 * @param {string} assert the assert module's real path
 * @param {string[]} files the tests' absolute paths
 * @returns {string}
 */
export const batchProgram = (assert, files) => {
  const lines = [
    "// Written by light test: " + String(files.length) + " tests in one program, one after another.",
    "import { arm } from " + JSON.stringify(assert) + ";",
    "",
    "const environment = (): Map<string, string> => {",
    "  const m = new Map<string, string>();",
    "  for (const k of Object.keys(process.env)) {",
    "    const v = process.env[k];",
    "    if (v !== undefined) m.set(k, v);",
    "  }",
    "  return m;",
    "};",
    "const started = environment();",
    "const restore = (): void => {",
    "  for (const k of Object.keys(process.env)) if (!started.has(k)) delete process.env[k];",
    "  for (const [k, v] of started) if (process.env[k] !== v) process.env[k] = v;",
    "};",
  ];
  files.forEach((file, i) => {
    const name = "finished" + String(i);
    lines.push("", "const " + name + " = arm();", "await import(" + JSON.stringify(file) + ");", "await " + name + ";", "restore();");
  });
  return lines.join("\n") + "\n";
};

/**
 * Write `batch`'s program, unless the same text is already there, and answer its path.
 * @param {Batch} batch
 * @param {string} assert
 * @returns {string}
 */
export const writeBatch = (batch, assert) => {
  const files = batch.tests.map((t) => t.path);
  const text = batchProgram(assert, files);
  const member = batch.tests[0].member.dir;
  const id = createHash("sha256")
    .update(member + "\n" + (batch.manifest ?? "") + "\n" + files.join("\n"))
    .digest("hex")
    .slice(0, 16);
  const dir = join(member, ".scriptc", "light-test");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, id + ".ts");
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) writeFileSync(path, text);
  return path;
};
