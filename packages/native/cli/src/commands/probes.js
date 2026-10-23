/**
 * @file `light-native probes [name…]`: the compiler probes in probes/ (one-file programs that decide design
 * branches): for each, scriptc's coverage with blockers failing, a native build, a run, and a
 * comparison with node; the verdicts go to probes/RESULTS.md. The probes keep their relative
 * imports of light (they predate the workspace and document compiler behaviour as it was found).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { capture } from "../run.js";
import { scriptcPath } from "@bootstrapp/light/native/scriptc.js";

/**
 * @param {string[]} args
 * @param {string} root
 * @returns {Promise<number>}
 */
export const run = async (args, root) => {
  const dir = join(root, "probes");
  const scriptc = scriptcPath(root);
  const out = join(dir, "out");
  mkdirSync(out, { recursive: true });
  const files = readdirSync(dir)
    .filter((f) => /^p.*\.ts$/.test(f))
    .sort()
    .map((f) => join(dir, f));
  if (existsSync(join(dir, "p5", "a", "main.ts"))) files.push(join(dir, "p5", "a", "main.ts"));
  const chosen = args.length > 0 ? files.filter((f) => args.some((a) => basename(f).startsWith(a))) : files;
  const version = (await capture(scriptc, ["--version"])).out.trim();
  let report = "# Probe results (" + new Date().toISOString().slice(0, 16) + "Z, scriptc " + version + ")\n\n";
  let status = 0;
  for (const p of chosen) {
    const name = p.endsWith("p5/a/main.ts") ? "p5" : basename(p, ".ts");
    const cov = await capture(scriptc, ["coverage", p, "--fail-on=blockers"], { cwd: root });
    const bld = await capture(scriptc, ["build", p, "-o", join(out, name), "--no-keep-llvm"], { cwd: root });
    const node = await capture("node", [p], { cwd: root });
    const native = bld.code === 0 ? await capture(join(out, name), [], { cwd: root }) : null;
    const equal = native !== null && native.out === node.out;
    const pass = cov.code === 0 && bld.code === 0 && native !== null && native.code === 0 && equal;
    if (!pass) status = 1;
    report += "## " + name + ": " + (pass ? "PASS" : "FAIL") + "\n";
    report += "- coverage rc=" + String(cov.code) + "\n";
    report += "- build rc=" + String(bld.code) + "; node rc=" + String(node.code) + "; native rc=" + String(native === null ? 1 : native.code) + "; outputs equal=" + (equal ? "yes" : "no") + "\n";
    if (!pass) {
      const tail = (/** @type {string} */ s, /** @type {number} */ n) => s.split("\n").slice(-n).join("\n");
      report += "```\n" + tail(cov.out, 25) + "\n--- build\n" + tail(bld.out, 25) + "\n--- node\n" + tail(node.out, 15) + "\n--- native\n" + (native === null ? "(build failed)" : tail(native.out, 15)) + "\n```\n";
    }
    report += "\n";
    console.log(name + ": " + (pass ? "PASS" : "FAIL"));
  }
  if (args.length === 0) writeFileSync(join(dir, "RESULTS.md"), report);
  return status;
};
