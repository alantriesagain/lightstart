/**
 * @file The probe runner: for each `p-*.js` beside it, report scriptc's static coverage, build a
 * native binary, run it, and compare the output with node's. Writes RESULTS.md. Run with
 * `node native/probes/run.js [--scriptc <path>]`.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const at = args.indexOf("--scriptc");
const scriptc = at >= 0 ? args[at + 1] : join(here, "..", "..", "node_modules", ".bin", "scriptc");
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
const lines = ["# Probe results (" + new Date().toISOString().slice(0, 16) + "Z, scriptc " + version + ", node " + process.version + ")", ""];
let failed = 0;
const files = readdirSync(here).filter((f) => /^p-.*\.js$/.test(f) && (only.length === 0 || only.some((o) => f.startsWith(o)))).sort();
for (const file of files) {
  const name = file.replace(/\.js$/, "");
  const path = join("native", "probes", file);
  const cov = run(scriptc, ["coverage", path, "--fail-on=blockers"]);
  const statically = /compile statically\s+(\d+)\s+\((\d+)%\)/.exec(cov.out);
  const deferred = /deferred to runtime/.test(cov.out);
  const fully = /fully static/.test(cov.out);
  const build = run(scriptc, ["build", path, "-o", join("native", "probes", "out", name), "--no-keep-llvm"]);
  const nodeRun = run("node", [path]);
  const native = build.code === 0 ? run(join(here, "out", name), []) : { code: -1, out: "(build failed)" };
  const same = nodeRun.out === native.out;
  const pass = cov.code === 0 && fully && !deferred && build.code === 0 && nodeRun.code === 0 && native.code === 0 && same;
  if (!pass) failed++;
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
  console.log(name + ": " + (pass ? "PASS" : "FAIL"));
}
writeFileSync(join(here, "RESULTS.md"), lines.join("\n"));
process.exitCode = failed > 0 ? 1 : 0;
