/**
 * @file `light test [member…] [--node-only] [--jobs N] [--batch N] [--timeout MS] [--opt dev|release] [-- test…]`: every member's
 * test/*.test.ts (or the tests named) run under node (fast) and under scriptc (the gate), and its
 * check/rules/*.test.js (light check rules, on node:test) under node alone; the
 * outputs must match byte for byte. A test whose first line is `// ffi: <manifest>` runs natively
 * with that manifest and under node with the manifest folder's node stand-in preloaded; one whose
 * first line is `// node-only` runs under node alone (it walks the file system or the repository).
 * One marked `// native-only` on its first two lines runs under scriptc alone.
 * Tests run with the member's folder as the working directory, $JOBS at a time (default 4), built
 * with scriptc's dev optimization unless --opt release; at dev, speed checks get room through
 * TEST_TIME_SCALE (the members' assert helpers read it). Results print in file order, each once
 * the ones before it are in; a run past $TEST_TIMEOUT milliseconds (15 minutes by default) is killed
 * and fails.
 * Tests that can share a program run $BATCH to one (default 8, `src/batch.js`): one native build
 * for the batch, the outputs compared as a file's are, the batch's files run alone when it fails.
 */
import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { assertFor, batchesOf, writeBatch } from "../batch.js";
import { ffiHeader, nativeOnly, nodeOnly, nodePreload, resolveFfi } from "../ffi.js";
import { prepare, prepareProject } from "../prepare.js";
import { Run, capture, pool } from "../run.js";
import { scriptcPath } from "@lightstart/light/native/scriptc.js";
import { Member, memberByName, members } from "../workspace.js";

export class TestFile {
  /** @type {Member} */
  member;
  /** @type {string} */
  path;

  /**
   * @param {Member} member
   * @param {string} path
   */
  constructor(member, path) {
    this.member = member;
    this.path = path;
  }

  get label() {
    return basename(this.member.dir) + "/" + relative(this.member.dir, this.path);
  }
}

/**
 * The files in `dir` whose names end with `suffix`, sorted, as `member`'s tests.
 * @param {Member} member
 * @param {string} dir
 * @param {string} suffix
 * @returns {TestFile[]}
 */
const filesIn = (member, dir, suffix) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(suffix))
        .sort()
        .map((f) => new TestFile(member, join(dir, f)))
    : [];

/**
 * The tests of `member`: test/*.test.ts, then the check rules' check/rules/*.test.js.
 * @param {Member} member
 * @returns {TestFile[]}
 */
export const testsOf = (member) => [...filesIn(member, join(member.dir, "test"), ".test.ts"), ...filesIn(member, join(member.dir, "check", "rules"), ".test.js")];

/**
 * Whether `path` is a check rule's test, which runs on node:test under node alone.
 * @param {string} path
 * @returns {boolean}
 */
export const ruleTest = (path) => path.endsWith(".test.js") && basename(join(path, "..")) === "rules";

/**
 * The members and tests the arguments name: members before `--`, test paths after it; every member when none.
 * @param {string} root
 * @param {string[]} args
 * @returns {{ targets: Member[], tests: TestFile[], flags: string[] }}
 */
export const selectTests = (root, args) => {
  const at = args.indexOf("--");
  const before = at < 0 ? args : args.slice(0, at);
  const after = at < 0 ? [] : args.slice(at + 1);
  const flags = [];
  const names = [];
  for (let i = 0; i < before.length; i++) {
    const a = before[i];
    if (a === "--jobs" || a === "--opt" || a === "--batch" || a === "--timeout") {
      flags.push(a, before[i + 1] ?? "");
      i++;
    } else if (a.startsWith("--")) flags.push(a);
    else names.push(a);
  }
  const targets = names.length > 0 ? names.map((n) => memberByName(root, n)) : members(root);
  let tests = targets.flatMap(testsOf);
  if (after.length > 0) {
    const wanted = after.map((p) => join(process.cwd(), p));
    tests = tests.filter((t) => wanted.includes(t.path) || after.some((p) => t.path.endsWith("/" + p)));
    if (tests.length === 0) throw new Error("no test matches " + after.join(", "));
  }
  return { targets: [...new Set(tests.map((t) => t.member))], tests, flags };
};

/**
 * @param {string[]} flags
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
const flagValue = (flags, name, fallback) => {
  const i = flags.indexOf(name);
  return i >= 0 && flags[i + 1] !== undefined && flags[i + 1].length > 0 ? flags[i + 1] : fallback;
};

/**
 * The tests `files` name, by path or by file name; every test when none.
 * @param {TestFile[]} tests
 * @param {string[]} files
 * @returns {TestFile[]}
 */
export const selectTestFiles = (tests, files) => {
  if (files.length === 0) return tests;
  const chosen = tests.filter((t) => files.some((file) => t.path === file || t.path.endsWith("/" + file) || basename(t.path) === basename(file)));
  if (chosen.length === 0) throw new Error("no test matches " + files.join(", "));
  return chosen;
};

class Outcome {
  /** @type {TestFile} */
  t;
  /** @type {Run | null} */
  node;
  /** @type {Run | null} */
  native;

  /**
   * @param {TestFile} t
   * @param {Run | null} node
   * @param {Run | null} native
   */
  constructor(t, node, native) {
    this.t = t;
    this.node = node;
    this.native = native;
  }
}

/**
 * Whether a test's or a batch's runs failed: an exit code that is not 0, or outputs that differ.
 * @param {Run | null} node
 * @param {Run | null} native
 * @returns {boolean}
 */
const failedRuns = (node, native) => (node !== null && node.code !== 0) || (native !== null && (native.code !== 0 || (node !== null && native.out !== node.out)));

/**
 * `tests` run under node and natively from their members' folders, a batch of them to a program
 * ($BATCH or --batch, default 8; 1 runs each alone). A batch that fails runs again file by file, so
 * a failure is reported as it would be alone. A run past --timeout or $TEST_TIMEOUT milliseconds
 * (900000 by default, 0 for none) is killed with what it started and fails. Each result prints, in
 * file order, once the ones before it are in.
 * @param {TestFile[]} tests
 * @param {string[]} flags
 * @param {string} root
 * @returns {Promise<number>}
 */
const runFiles = async (tests, flags, root) => {
  const jobs = Number(flagValue(flags, "--jobs", process.env["JOBS"] ?? "4"));
  const size = Number(flagValue(flags, "--batch", process.env["BATCH"] ?? "8"));
  const timeout = Number(flagValue(flags, "--timeout", process.env["TEST_TIMEOUT"] ?? "900000"));
  const timeoutMs = timeout > 0 ? timeout : undefined;
  const opt = flagValue(flags, "--opt", process.env["OPT"] ?? "dev");
  const nodeOnlyRun = flags.includes("--node-only");
  const scriptc = nodeOnlyRun ? "" : scriptcPath(root);
  const env = { ...process.env };
  if (opt === "dev" && env["TEST_TIME_SCALE"] === undefined) env["TEST_TIME_SCALE"] = "4";
  const start = Date.now();
  const runnable = nodeOnlyRun ? tests.filter((t) => !nativeOnly(t.path)) : tests;
  /** @param {TestFile} t */
  const manifestOf = (t) => {
    const header = ffiHeader(t.path);
    return header === null ? null : resolveFfi(t.member, header);
  };
  /**
   * `path` run under node (unless `withNode` is false) and natively (unless `withNative` is false).
   * @param {string} path
   * @param {Member} member
   * @param {string | null} manifest
   * @param {boolean} withNode
   * @param {boolean} withNative
   * @returns {Promise<{ node: Run | null, native: Run | null }>}
   */
  const runPath = async (path, member, manifest, withNode, withNative) => {
    let node = null;
    if (withNode) {
      const preload = manifest === null ? null : nodePreload(manifest);
      const nodeArgs = ["--no-warnings"];
      if (preload !== null) nodeArgs.push("--experimental-vm-modules", "--import", preload);
      nodeArgs.push(path);
      node = await capture("node", nodeArgs, { cwd: member.dir, env, timeoutMs });
    }
    if (!withNative || (node !== null && node.timedOut)) return { node, native: null };
    const nativeArgs = ["run", "--optimization", opt];
    if (manifest !== null) nativeArgs.push("--ffi", manifest);
    nativeArgs.push(path);
    const native = await capture(scriptc, nativeArgs, { cwd: member.dir, env, timeoutMs });
    return { node, native };
  };
  /**
   * One test alone, as it always ran.
   * @param {TestFile} t
   * @param {string | null} manifest
   * @returns {Promise<Outcome>}
   */
  const runAlone = async (t, manifest) => {
    const withNative = !(nodeOnlyRun || nodeOnly(t.path) || ruleTest(t.path));
    const { node, native } = await runPath(t.path, t.member, manifest, !nativeOnly(t.path), withNative);
    return new Outcome(t, node, native);
  };
  /**
   * A run's exit code as the FAIL line says it, and its time when it ran out of it.
   * @param {string} name
   * @param {Run} r
   * @returns {string}
   */
  const codeOf = (name, r) => name + "=" + String(r.code) + (r.timedOut ? ", timed out after " + String(Math.round(timeout / 1000)) + " s" : "");
  let status = 0;
  /** @param {Outcome} o */
  const report = ({ t, node, native }) => {
    if (failedRuns(node, native)) {
      status = 1;
      console.log("FAIL " + t.label + " (" + (node === null ? codeOf("scriptc", /** @type {Run} */ (native)) : codeOf("node", node) + (native === null ? "" : " " + codeOf("scriptc", native))) + ")");
      if (node !== null) {
        console.log("--- node");
        process.stdout.write(node.out);
      }
      if (native !== null) {
        console.log("--- scriptc");
        process.stdout.write(native.out);
      }
    } else console.log("PASS " + t.label + (native === null ? " (node only)" : node === null ? " (native only)" : ""));
  };
  /** @type {Map<TestFile, Outcome>} */
  const byTest = new Map();
  let printed = 0;
  const flush = () => {
    for (let o = byTest.get(runnable[printed]); o !== undefined; o = byTest.get(runnable[printed])) {
      report(o);
      printed++;
    }
  };
  const batches = batchesOf(runnable, size, manifestOf);
  let again = 0;
  await pool(batches, jobs, async (b) => {
    /** @type {Outcome[]} */
    let done = [];
    if (b.tests.length === 1) done = [await runAlone(b.tests[0], b.manifest)];
    else {
      const member = b.tests[0].member;
      const program = writeBatch(b, /** @type {string} */ (assertFor(member.dir)));
      const { node, native } = await runPath(program, member, b.manifest, true, !nodeOnlyRun);
      if (!failedRuns(node, native)) done = b.tests.map((t) => new Outcome(t, new Run(0, ""), nodeOnlyRun ? null : new Run(0, "")));
      else {
        again++;
        for (const t of b.tests) done.push(await runAlone(t, b.manifest));
      }
    }
    for (const o of done) byTest.set(o.t, o);
    flush();
  });
  flush();
  const programs = batches.length < runnable.length ? ", " + String(batches.length) + (batches.length === 1 ? " program" : " programs") + (again > 0 ? " (" + String(again) + (again === 1 ? " batch" : " batches") + " run again file by file)" : "") : "";
  console.log(String(runnable.length) + " tests in " + String(Math.round((Date.now() - start) / 1000)) + " s, " + String(jobs) + " at a time, " + (nodeOnlyRun ? "node only" : opt + " builds") + programs);
  return status;
};

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const { targets, tests, flags } = selectTests(root, args);
  for (const m of targets) await prepare(root, m, "test");
  return runFiles(tests, flags, root);
};

/**
 * A project's tests, its prepare steps first; `files` select tests by name.
 * @param {import("../project.js").Project} project
 * @param {string[]} flags
 * @param {string[]} [files]
 * @returns {Promise<number>}
 */
export const runProject = async (project, flags, files = []) => {
  await prepareProject(project, "test");
  return runFiles(selectTestFiles(testsOf(project), files), flags, project.dir);
};
