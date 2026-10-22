/**
 * @file `light-native test [member…] [--node-only] [--jobs N] [--opt dev|release] [-- test…]`: every member's
 * test/*.test.ts (or the tests named) run under node (fast) and under scriptc (the gate); the
 * outputs must match byte for byte. A test whose first line is `// ffi: <manifest>` runs natively
 * with that manifest and under node with the manifest folder's node stand-in preloaded; one whose
 * first line is `// node-only` runs under node alone (it walks the file system or the repository).
 * Tests run with the member's folder as the working directory, $JOBS at a time (default 4), built
 * with scriptc's dev optimization unless --opt release; at dev, speed checks get room through
 * TEST_TIME_SCALE (the members' assert helpers read it). Results print in file order.
 */
import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { ffiHeader, nodeOnly, nodePreload, resolveFfi } from "../ffi.js";
import { prepare } from "../prepare.js";
import { capture, pool } from "../run.js";
import { scriptcPath } from "../scriptc.js";
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
 * The tests of `member`: test/*.test.ts.
 * @param {Member} member
 * @returns {TestFile[]}
 */
export const testsOf = (member) => {
  const dir = join(member.dir, "test");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".test.ts"))
    .sort()
    .map((f) => new TestFile(member, join(dir, f)));
};

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
    if (a === "--jobs" || a === "--opt") {
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
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const { targets, tests, flags } = selectTests(root, args);
  for (const m of targets) await prepare(root, m);
  const jobs = Number(flagValue(flags, "--jobs", process.env["JOBS"] ?? "4"));
  const opt = flagValue(flags, "--opt", process.env["OPT"] ?? "dev");
  const nodeOnlyRun = flags.includes("--node-only");
  const scriptc = nodeOnlyRun ? "" : scriptcPath(root);
  const env = { ...process.env };
  if (opt === "dev" && env["TEST_TIME_SCALE"] === undefined) env["TEST_TIME_SCALE"] = "4";
  const start = Date.now();
  const results = await pool(tests, jobs, async (t) => {
    const header = ffiHeader(t.path);
    const manifest = header === null ? null : resolveFfi(t.member, header);
    const preload = manifest === null ? null : nodePreload(manifest);
    const nodeArgs = ["--no-warnings"];
    if (preload !== null) nodeArgs.push("--import", preload);
    nodeArgs.push(t.path);
    const node = await capture("node", nodeArgs, { cwd: t.member.dir, env });
    if (nodeOnlyRun || nodeOnly(t.path)) return { t, node, native: null };
    const nativeArgs = ["run", "--optimization", opt];
    if (manifest !== null) nativeArgs.push("--ffi", manifest);
    nativeArgs.push(t.path);
    const native = await capture(scriptc, nativeArgs, { cwd: t.member.dir, env });
    return { t, node, native };
  });
  let status = 0;
  for (const { t, node, native } of results) {
    const failed = node.code !== 0 || (native !== null && (native.code !== 0 || native.out !== node.out));
    if (failed) {
      status = 1;
      console.log("FAIL " + t.label + " (node=" + String(node.code) + (native === null ? "" : " scriptc=" + String(native.code)) + ")");
      console.log("--- node");
      process.stdout.write(node.out);
      if (native !== null) {
        console.log("--- scriptc");
        process.stdout.write(native.out);
      }
    } else console.log("PASS " + t.label + (native === null ? " (node only)" : ""));
  }
  console.log(String(tests.length) + " tests in " + String(Math.round((Date.now() - start) / 1000)) + " s, " + String(jobs) + " at a time, " + (nodeOnlyRun ? "node only" : opt + " builds"));
  return status;
};
