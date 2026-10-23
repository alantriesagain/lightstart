/**
 * @file The desktop coverage gate: scriptc's coverage of the demo backend, against the shim's
 * manifest, read from scriptc's JSON report, must be fully static with nothing deferred to a
 * runtime throw, no slow path and no divergence from node. Skipped, with a
 * notice, when WebKitGTK's development package is not installed, since the manifest needs the
 * archive. Run with `node native/desktop/coverage.js`.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shim } from "./build.js";
import { formatDiagnostic, gate, readCoverage } from "../diagnostics.js";
import { scriptcPath } from "../scriptc.js";

const here = dirname(fileURLToPath(import.meta.url));
const light = join(here, "..", "..");
const hasWebkit = spawnSync("pkg-config", ["--exists", "webkit2gtk-4.1"]).status === 0 || spawnSync("pkg-config", ["--exists", "webkitgtk-6.0"]).status === 0;
if (process.platform === "linux" && !hasWebkit) {
  console.log("desktop coverage skipped: no WebKitGTK development package");
  process.exit(0);
}
const target = process.platform === "darwin" ? "mac-arm64" : process.platform === "win32" ? "win-x64" : "linux-x64";
const dir = shim(target);
const scriptc = scriptcPath(light);
const entry = "native/desktop/demo/backend.js";
const coverage = readCoverage(scriptc, entry, { cwd: light, args: ["--ffi", join(dir, "ffi.json")] });
const result = gate(coverage, {});
for (const d of result.failures) console.log(formatDiagnostic(d, light));
for (const note of result.notes) console.log(`note: ${note}`);
const stats = coverage.envelope.stats;
if (result.pass) {
  console.log(`${entry}: fully static, ${stats?.statementsTotal ?? "?"} statements, nothing deferred`);
  process.exit(0);
}
console.log(`${entry}: ${coverage.slowPaths.length} slow paths, ${coverage.blockers.length} blockers, ${coverage.divergences.length} divergences, ${coverage.deferred.length} deferred statements${coverage.fullyStatic ? "" : ", not fully static"}`);
process.exit(1);
