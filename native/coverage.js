/**
 * @file The native gate: scriptc's coverage of an entry (native/index.ts by default) must
 * have no blocker and no slow path (a write that makes methods replaceable, so every call
 * dispatches dynamically), and, unless `--allow-dynamic` says the entry's graph holds
 * JSDoc-typed JavaScript, be fully static with no statement deferred to a runtime throw.
 * Run with `node native/coverage.js [entry] [--allow-dynamic] [--scriptc <path>]`.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptcPath } from "./scriptc.js";

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, "..");
const args = process.argv.slice(2);
const at = args.indexOf("--scriptc");
const scriptc = at >= 0 ? args[at + 1] : scriptcPath(rootDir);
const allowDynamic = args.includes("--allow-dynamic");
const entry = args.find((arg, i) => !arg.startsWith("--") && (at < 0 || i !== at + 1)) ?? "native/index.ts";
const r = spawnSync(scriptc, ["coverage", entry, "--fail-on=slow-paths"], { encoding: "utf8", cwd: rootDir, timeout: 600000 });
const out = (r.stdout ?? "") + (r.stderr ?? "");
const statically = /compile statically\s+(\d+)\s+\((\d+)%\)/.exec(out);
const fully = /fully static/.test(out);
const deferred = /deferred to runtime/.test(out);
if (r.status === 0 && (allowDynamic || (fully && !deferred))) {
  console.log(fully ? `${entry}: fully static, ${statically ? statically[1] : "?"} statements, nothing deferred` : `${entry}: no blocker and no slow path, ${statically ? `${statically[1]} statements (${statically[2]}%) static` : "static share unknown"}`);
  process.exit(0);
}
console.log(out);
console.log(`${entry}: ${/slower natively/.test(out) ? "slow paths (a write makes methods replaceable)" : r.status !== 0 ? "blockers" : !fully ? "a dynamic remainder" : "statements deferred to runtime"}`);
process.exit(1);
