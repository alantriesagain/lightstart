/**
 * @file The probe runner: for each `p-*.js` beside it (a `p-<name>.<part>.js` is a side module of
 * one, not a probe), report scriptc's static coverage, build a native binary, run it, and compare
 * the output with node's. Writes RESULTS.md; a run of some probes (`node native/probes/run.js p-aj`)
 * replaces their sections in it and keeps the rest. Run with `node native/probes/run.js [p-…] [--scriptc <path>]`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptcPath } from "../scriptc.js";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf("--scriptc");
const scriptc = at >= 0 ? args[at + 1] : scriptcPath(join(here, "..", ".."));
const only = args.filter((a) => a.startsWith("p-"));
mkdirSync(join(here, "out"), { recursive: true });

/**
 * @param {string} cmd
 * @param {string[]} cmdArgs
 */
const run = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", cwd: join(here, "..", ".."), timeout: 600000 });
  return { code: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? "") };
};

const version = run(scriptc, ["--version"]).out.trim();
const header = "# Probe results (" + new Date().toISOString().slice(0, 16) + "Z, scriptc " + version + ", node " + process.version + ")";
/** Each probe's section of RESULTS.md, by name. @type {Map<string, string>} */
const sections = new Map();
let failed = 0;
const files = readdirSync(here).filter((f) => /^p-[^.]*\.js$/.test(f) && (only.length === 0 || only.some((o) => f.startsWith(o)))).sort();
/**
 * A probe beside a `<name>.c` and a `<name>.ffi.json` links that C into a static archive under
 * `out/` and passes the manifest to the compiler; such a probe runs natively only.
 * @param {string} name
 */
const ffiArgs = (name) => {
  const manifest = join(here, name + ".ffi.json");
  if (!existsSync(manifest)) return [];
  const object = join(here, "out", name + ".o");
  const archive = join(here, "out", "lib" + name + ".a");
  const cc = run("cc", ["-O2", "-fPIC", "-c", join(here, name + ".c"), "-o", object]);
  if (cc.code !== 0) throw new Error("cc failed for " + name + "\n" + cc.out);
  const ar = run("ar", ["rcs", archive, object]);
  if (ar.code !== 0) throw new Error("ar failed for " + name + "\n" + ar.out);
  return ["--ffi", manifest];
};

for (const file of files) {
  const name = file.replace(/\.js$/, "");
  const path = join("native", "probes", file);
  const ffi = ffiArgs(name);
  const cov = run(scriptc, ["coverage", path, "--fail-on=blockers", ...ffi]);
  const statically = /compile statically\s+(\d+)\s+\((\d+)%\)/.exec(cov.out);
  const deferred = /deferred to runtime/.test(cov.out);
  const fully = /fully static/.test(cov.out);
  const build = run(scriptc, ["build", path, "-o", join("native", "probes", "out", name), "--no-keep-llvm", ...ffi]);
  const nodeRun = ffi.length > 0 ? { code: 0, out: "", ms: 0 } : run("node", [path]);
  const native = build.code === 0 ? run(join(here, "out", name), []) : { code: -1, out: "(build failed)" };
  const same = ffi.length > 0 ? !/^FAIL /m.test(native.out) && /^done ok/m.test(native.out) : nodeRun.out === native.out;
  const pass = cov.code === 0 && fully && !deferred && build.code === 0 && nodeRun.code === 0 && native.code === 0 && same;
  if (!pass) failed++;
  /** @type {string[]} */
  const lines = [];
  lines.push("## " + name + ": " + (pass ? "PASS" : "FAIL"));
  lines.push("- coverage rc=" + String(cov.code) + " static=" + (statically ? statically[1] + " (" + statically[2] + "%)" : "?") + " fully=" + String(fully) + " deferred=" + String(deferred));
  lines.push("- build rc=" + String(build.code) + " node rc=" + String(nodeRun.code) + " native rc=" + String(native.code) + " same output=" + String(same));
  if (!pass) {
    lines.push("```");
    lines.push(cov.out.trim().split("\n").slice(-20).join("\n"));
    lines.push("--- build");
    lines.push(build.out.trim().split("\n").slice(-20).join("\n"));
    lines.push("--- node");
    lines.push(nodeRun.out.trim().slice(-1200));
    lines.push("--- native");
    lines.push(native.out.trim().slice(-1200));
    lines.push("```");
  }
  lines.push("");
  sections.set(name, lines.join("\n"));
  console.log(name + ": " + (pass ? "PASS" : "FAIL"));
}
const resultsPath = join(here, "RESULTS.md");
/** The report: the whole run, or the sections run put into the report kept. @returns {string} */
const report = () => {
  if (only.length === 0 || !existsSync(resultsPath)) return [header, "", ...sections.values()].join("\n");
  const parts = readFileSync(resultsPath, "utf8").split(/\n(?=## )/);
  const kept = parts.map((part, i) => {
    if (i === 0) return header + "\n";
    const m = /^## ([^:]+):/.exec(part);
    const section = m !== null ? sections.get(m[1]) : undefined;
    return section !== undefined ? section : part;
  });
  for (const [name, section] of sections) if (!parts.some((part) => part.startsWith("## " + name + ":"))) kept.push(section);
  return kept.join("\n");
};
writeFileSync(resultsPath, report());
process.exitCode = failed > 0 ? 1 : 0;
