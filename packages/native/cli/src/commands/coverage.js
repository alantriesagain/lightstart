/**
 * @file `light-native coverage [member…] [--jobs N] [--apps]`: scriptc's static coverage of every app
 * entry (with its `native.ffi` manifest) and, unless --apps, of every test (with its `// ffi:`
 * manifest; node-only tests left out), read from scriptc's JSON report through light's
 * `packages/light/native/diagnostics.js` gate: each must compile fully statically, with no blocker, slow path,
 * divergence from node, deferred or unreached site. The entries are analysed $JOBS at a time
 * (default 4); results print in order.
 */
import { join, relative } from "node:path";
import { formatDiagnostic, gate, parseCoverage } from "@bootstrapp/light/native/diagnostics.js";
import { scriptcPath } from "@bootstrapp/light/native/scriptc.js";
import { ffiHeader, nodeOnly, resolveFfi } from "../ffi.js";
import { prepare } from "../prepare.js";
import { captureStreams, pool } from "../run.js";
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
    const flags = ["coverage", e.path, "--print=diagnostics", "--fail-on=slow-paths"];
    if (e.manifest !== null) flags.push("--ffi", e.manifest);
    return captureStreams(scriptc, flags, { cwd: e.member.dir });
  });
  let status = 0;
  for (let i = 0; i < entries.length; i++) {
    const label = relative(root, entries[i].path);
    const r = results[i];
    let coverage;
    try {
      coverage = parseCoverage(r.stdout, label, r.code, r.stderr);
    } catch (error) {
      status = 1;
      console.log("NOT STATIC: " + label + "\n" + (error instanceof Error ? error.message : String(error)));
      continue;
    }
    const verdict = gate(coverage);
    const stats = coverage.envelope.stats;
    const statements = stats === undefined ? "" : " (" + String(stats.statementsStatic) + "/" + String(stats.statementsTotal) + " statements)";
    if (verdict.pass && coverage.status === 0) {
      console.log("static: " + label + statements);
      continue;
    }
    status = 1;
    console.log("NOT STATIC: " + label + statements);
    for (const d of verdict.failures.slice(0, 40)) console.log("  " + formatDiagnostic(d, root));
    if (verdict.failures.length > 40) console.log("  … " + String(verdict.failures.length - 40) + " more");
    if (verdict.failures.length === 0) console.log(r.stderr.split("\n").slice(-20).join("\n"));
  }
  console.log(String(entries.length) + " entries in " + String(Math.round((Date.now() - start) / 1000)) + " s, " + String(jobs) + " at a time");
  return status;
};
