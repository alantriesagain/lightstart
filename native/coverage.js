/**
 * @file The native gate: scriptc's coverage of native/index.js must be fully static with no
 * statement deferred to a runtime throw. Run with `node native/coverage.js [--scriptc <path>]`.
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
const r = spawnSync(scriptc, ["coverage", "native/index.js", "--fail-on=blockers"], { encoding: "utf8", cwd: rootDir, timeout: 600000 });
const out = (r.stdout ?? "") + (r.stderr ?? "");
const statically = /compile statically\s+(\d+)\s+\((\d+)%\)/.exec(out);
const fully = /fully static/.test(out);
const deferred = /deferred to runtime/.test(out);
if (r.status === 0 && fully && !deferred) {
  console.log(`native/index.js: fully static, ${statically ? statically[1] : "?"} statements, nothing deferred`);
  process.exit(0);
}
console.log(out);
console.log(`native/index.js: ${r.status !== 0 ? "blockers" : !fully ? "a dynamic remainder" : "statements deferred to runtime"}`);
process.exit(1);
