/**
 * @file `light-native coverage [member…] [--jobs N] [--apps]`: scriptc's static coverage of every app entry (with its
 * `native.ffi` manifest) and, unless --apps, of every test (with its `// ffi:` manifest; node-only tests
 * left out):
 * each must compile statically (scriptc's exit code with `--fail-on=slow-paths`, and no site that
 * compiles dynamically). The entries are analysed $JOBS at a time (default 4); results print in order.
 */
import { join, relative } from "node:path";
import { ffiHeader, nodeOnly, resolveFfi } from "../ffi.js";
import { prepare } from "../prepare.js";
import { capture, pool } from "../run.js";
import { scriptcPath } from "../scriptc.js";
import { Member, memberByName, members } from "../workspace.js";
import { testsOf } from "./test.js";

class Entry {
  /** @type {Member} */
  member;
  /** @type {string} */
  path;
  /** @type {string | null} */
  manifest;

  /**
   * @param {Member} member
   * @param {string} path
   * @param {string | null} manifest
   */
  constructor(member, path, manifest) {
    this.member = member;
    this.path = path;
    this.manifest = manifest;
  }
}

/**
 * The app entries and the tests to cover, apps first.
 * @param {string} _root
 * @param {Member[]} targets
 * @param {boolean} appsOnly
 * @returns {Entry[]}
 */
const entriesOf = (_root, targets, appsOnly) => {
  /** @type {Entry[]} */
  const out = [];
  for (const app of targets.filter((m) => m.group === "apps")) {
    if (typeof app.config.entry !== "string") continue;
    if (app.config.coverage === false) continue;
    out.push(new Entry(app, join(app.dir, app.config.entry), typeof app.config.ffi === "string" ? resolveFfi(app, app.config.ffi) : null));
  }
  if (appsOnly) return out;
  for (const m of targets)
    for (const t of testsOf(m)) {
      if (nodeOnly(t.path)) continue;
      const header = ffiHeader(t.path);
      out.push(new Entry(m, t.path, header === null ? null : resolveFfi(m, header)));
    }
  return out;
};

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const names = args.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  const at = args.indexOf("--jobs");
  const jobs = Number(at >= 0 ? (args[at + 1] ?? "4") : (process.env["JOBS"] ?? "4"));
  const targets = names.length > 0 ? names.map((n) => memberByName(root, n)) : members(root);
  for (const m of targets) await prepare(root, m);
  const scriptc = scriptcPath(root);
  const entries = entriesOf(root, targets, args.includes("--apps"));
  const start = Date.now();
  const results = await pool(entries, jobs, async (e) => {
    const flags = ["coverage", e.path];
    if (e.manifest !== null) flags.push("--ffi", e.manifest);
    flags.push("--fail-on=slow-paths");
    return capture(scriptc, flags, { cwd: e.member.dir });
  });
  let status = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const r = results[i];
    const label = relative(root, e.path);
    const dynamic = r.out.split("\n").filter((l) => /runs with --dynamic|compile dynamically/.test(l) && !/\b0 sites\b|\(0%\)/.test(l));
    if (r.code !== 0 || dynamic.length > 0) {
      status = 1;
      console.log("NOT STATIC: " + label);
      console.log(r.out.split("\n").slice(-40).join("\n"));
    } else console.log("static: " + label);
  }
  console.log(String(entries.length) + " entries in " + String(Math.round((Date.now() - start) / 1000)) + " s, " + String(jobs) + " at a time");
  return status;
};
