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
 * for the batch, the outputs compared as a file's are, the tests that did not pass in a failed batch
 * run again alone.
 */
import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { assertFor, batchesOf, lateIn, passedInBatch, sectionIn, writeBatch } from "../batch.js";
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
 * ($BATCH or --batch, default 8; 1 runs each alone). In a batch that fails, the tests that did not
 * pass in it run again alone, so a failure is reported as it would be alone. A run past --timeout or $TEST_TIMEOUT milliseconds
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
   * `path` run under node (unless `withNode` is false) and natively (unless `withNative` is false),
   * each killed past `ms`; not natively when node ran out of time.
   * @param {string} path
   * @param {Member} member
   * @param {string | null} manifest
   * @param {boolean} withNode
   * @param {boolean} withNative
   * @param {number | undefined} ms
   * @returns {Promise<{ node: Run | null, native: Run | null }>}
   */
  const runPath = async (path, member, manifest, withNode, withNative, ms) => {
    let node = null;
    if (withNode) {
      const preload = manifest === null ? null : nodePreload(manifest);
      const nodeArgs = ["--no-warnings"];
      if (preload !== null) nodeArgs.push("--experimental-vm-modules", "--import", preload);
      nodeArgs.push(path);
      node = await capture("node", nodeArgs, { cwd: member.dir, env, timeoutMs: ms });
    }
    if (!withNative || (node !== null && (node.timedOut || lateIn(node.out) !== null))) return { node, native: null };
    const nativeArgs = ["run", "--optimization", opt];
    if (manifest !== null) nativeArgs.push("--ffi", manifest);
    nativeArgs.push(path);
    const native = await capture(scriptc, nativeArgs, { cwd: member.dir, env, timeoutMs: ms });
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
    const { node, native } = await runPath(t.path, t.member, manifest, !nativeOnly(t.path), withNative, timeoutMs);
    return new Outcome(t, node, native);
  };
  /**
   * What a batch's run printed for test `index`, as that test's own run: exit 1 and timed out when
   * the batch says the test ran out of its time there.
   * @param {Run | null} run
   * @param {string} index
   * @returns {Run | null}
   */
  const ownRun = (run, index) => {
    if (run === null) return null;
    const late = lateIn(run.out) === index;
    const own = new Run(late ? 1 : 0, sectionIn(run.out, index));
    own.timedOut = late;
    return own;
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
  let failedBatches = 0;
  let again = 0;
  await pool(batches, jobs, async (b) => {
    /** @type {Outcome[]} */
    let done = [];
    if (b.tests.length === 1) done = [await runAlone(b.tests[0], b.manifest)];
    else {
      const member = b.tests[0].member;
      const program = writeBatch(b, /** @type {string} */ (assertFor(member.dir)), timeoutMs ?? 0);
      const backstop = timeoutMs === undefined ? undefined : timeoutMs * b.tests.length;
      const { node, native } = await runPath(program, member, b.manifest, true, !nodeOnlyRun, backstop);
      const passed = new Outcome(b.tests[0], new Run(0, ""), nodeOnlyRun ? null : new Run(0, ""));
      if (!failedRuns(node, native)) done = b.tests.map((t) => new Outcome(t, passed.node, passed.native));
      else {
        failedBatches++;
        const clean = passedInBatch(b.tests.length, node === null ? "" : node.out, native === null ? null : native.out, !nodeOnlyRun);
        const late = [node === null ? null : lateIn(node.out), native === null ? null : lateIn(native.out)];
        for (let i = 0; i < b.tests.length; i++)
          if (clean[i]) done.push(new Outcome(b.tests[i], passed.node, passed.native));
          else if (late.includes(String(i))) done.push(new Outcome(b.tests[i], ownRun(node, String(i)), ownRun(native, String(i))));
          else {
            again++;
            done.push(await runAlone(b.tests[i], b.manifest));
          }
      }
    }
    for (const o of done) byTest.set(o.t, o);
    flush();
  });
  flush();
  /**
   * @param {number} n
   * @param {string} one
   * @param {string} many
   */
  const plural = (n, one, many) => String(n) + " " + (n === 1 ? one : many);
  const programs = batches.length < runnable.length ? ", " + plural(batches.length, "program", "programs") + (failedBatches > 0 ? " (" + plural(again, "test", "tests") + " run again alone, from " + plural(failedBatches, "batch", "batches") + ")" : "") : "";
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
