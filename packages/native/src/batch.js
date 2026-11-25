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
 * The program that runs `files` one after another: a marker line, arm, import the test, wait for
 * its `done()` (the import and the wait at most `timeoutMs`, when it is above 0: past it a timeout
 * marker and exit 1), then put back the environment the program started with; a last marker at the
 * end.
 * @param {string} assert the assert module's real path
 * @param {string[]} files the tests' absolute paths
 * @param {number} timeoutMs
 * @returns {string}
 */
export const batchProgram = (assert, files, timeoutMs) => {
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
  if (timeoutMs > 0)
    lines.push(
      "const within = (finished: Promise<void>, ms: number): Promise<boolean> =>",
      "  new Promise<boolean>((resolve) => {",
      "    const timer = setTimeout(() => resolve(false), ms);",
      "    finished.then(() => {",
      "      clearTimeout(timer);",
      "      resolve(true);",
      "    });",
      "  });",
    );
  files.forEach((file, i) => {
    const name = "finished" + String(i);
    lines.push("", "console.log(" + JSON.stringify(MARK + String(i)) + ");", "const " + name + " = arm();");
    if (timeoutMs > 0)
      lines.push("if (!(await within(import(" + JSON.stringify(file) + ").then(() => " + name + "), " + String(timeoutMs) + "))) {", "  console.log(" + JSON.stringify(MARK + LATE) + ");", "  process.exit(1);", "}");
    else lines.push("await import(" + JSON.stringify(file) + ");", "await " + name + ";");
    lines.push("restore();");
  });
  lines.push("", "console.log(" + JSON.stringify(MARK + "end") + ");");
  return lines.join("\n") + "\n";
};

/** The line a batch program prints before each test (its index), after the last ("end"), and when one runs out of time. */
export const MARK = "@@ light test, file ";
const LATE = "timed out";

/**
 * The index of the test a batch's output says ran out of its time, or null.
 * @param {string} out
 * @returns {string | null}
 */
export const lateIn = (out) => {
  /** @type {string | null} */
  let last = null;
  for (const line of out.split("\n"))
    if (line === MARK + LATE) return last;
    else if (line.startsWith(MARK)) last = line.slice(MARK.length);
  return null;
};

/**
 * What a batch printed for its test `index` ("" when it never started).
 * @param {string} out
 * @param {string} index
 * @returns {string}
 */
export const sectionIn = (out, index) => {
  const own = sectionsOf(out).get(index);
  return own === undefined ? "" : own + "\n";
};

/**
 * A batch's output by test: each marker's index to what the program printed until the next marker.
 * @param {string} out
 * @returns {Map<string, string>}
 */
const sectionsOf = (out) => {
  /** @type {Map<string, string>} */
  const sections = new Map();
  /** @type {string | null} */
  let key = null;
  /** @type {string[]} */
  let lines = [];
  for (const line of out.split("\n"))
    if (line.startsWith(MARK)) {
      if (key !== null) sections.set(key, lines.join("\n"));
      key = line.slice(MARK.length);
      lines = [];
    } else if (key !== null) lines.push(line);
  if (key !== null) sections.set(key, lines.join("\n"));
  return sections;
};

/**
 * For each of a failed batch's `count` tests, whether it passed there all the same: the marker
 * after it printed (its `done()` came), its own output holds a PASS tally and no FAIL line, and
 * the native run printed the same for it. The rest run again alone. `native` is null for a batch
 * run under node alone; `withNative` says whether a native run was expected.
 * @param {number} count
 * @param {string} node
 * @param {string | null} native
 * @param {boolean} withNative
 * @returns {boolean[]}
 */
export const passedInBatch = (count, node, native, withNative) => {
  const byNode = sectionsOf(node);
  const byNative = native === null ? null : sectionsOf(native);
  /**
   * @param {Map<string, string>} sections
   * @param {number} i
   */
  const clean = (sections, i) => {
    const own = sections.get(String(i));
    return own !== undefined && sections.has(i + 1 < count ? String(i + 1) : "end") && /^PASS \d+\/\d+$/m.test(own) && !/^FAIL /m.test(own);
  };
  /** @type {boolean[]} */
  const out = [];
  for (let i = 0; i < count; i++)
    if (withNative && byNative === null) out.push(false);
    else out.push(clean(byNode, i) && (byNative === null || (clean(byNative, i) && byNative.get(String(i)) === byNode.get(String(i)))));
  return out;
};

/**
 * Write `batch`'s program, unless the same text is already there, and answer its path.
 * @param {Batch} batch
 * @param {string} assert
 * @param {number} timeoutMs each test's time, 0 for none
 * @returns {string}
 */
export const writeBatch = (batch, assert, timeoutMs) => {
  const files = batch.tests.map((t) => t.path);
  const text = batchProgram(assert, files, timeoutMs);
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
