/**
 * @file The native test runner: every `native/*.test.js` runs under node and under
 * `scriptc run`; both must exit zero and print the same output. Run with
 * `node native/run.js [--scriptc <path>] [--node-only] [name …]`.
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptcPath } from "./scriptc.js";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, "..");
const args = process.argv.slice(2);
const at = args.indexOf("--scriptc");
const scriptc = at >= 0 ? args[at + 1] : scriptcPath(rootDir);
const nodeOnly = args.includes("--node-only");
const only = args.filter((a, i) => !a.startsWith("--") && (at < 0 || i !== at + 1));

/**
 * @param {string} cmd
 * @param {string[]} cmdArgs
 */
const run = (cmd, cmdArgs) => {
  const started = Date.now();
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", cwd: rootDir, timeout: 600000 });
  return { code: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? ""), ms: Date.now() - started };
};

let failed = 0;
const files = readdirSync(here).filter((f) => f.endsWith(".test.js") && (only.length === 0 || only.some((o) => f.includes(o)))).sort();
for (const file of files) {
  const path = join("native", file);
  const n = run("node", [path]);
  if (n.code !== 0) {
    failed++;
    console.log(`FAIL ${file} (node exit ${n.code})\n${n.out}`);
    continue;
  }
  if (nodeOnly) {
    console.log(`PASS ${file} (node ${n.ms} ms, ${n.out.split("\n").filter((l) => l.startsWith("ok ")).length} checks)`);
    continue;
  }
  const s = run(scriptc, ["run", path]);
  if (s.code !== 0 || s.out !== n.out) {
    failed++;
    console.log(`FAIL ${file} (node ${n.code}, scriptc ${s.code})\n--- node\n${n.out}\n--- scriptc\n${s.out}`);
  } else console.log(`PASS ${file} (node ${n.ms} ms, scriptc ${s.ms} ms, ${n.out.split("\n").filter((l) => l.startsWith("ok ")).length} checks)`);
}
if (files.length === 0) {
  console.log("no native tests matched");
  process.exit(1);
}
process.exit(failed > 0 ? 1 : 0);
