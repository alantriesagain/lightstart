/**
 * @file The desktop coverage gate: scriptc's coverage of the demo backend, against the shim's
 * manifest, must be fully static with nothing deferred to a runtime throw. Skipped, with a
 * notice, when WebKitGTK's development package is not installed, since the manifest needs the
 * archive. Run with `node native/desktop/coverage.js`.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shim } from "./build.js";

const here = dirname(fileURLToPath(import.meta.url));
const light = join(here, "..", "..");
const hasWebkit = spawnSync("pkg-config", ["--exists", "webkit2gtk-4.1"]).status === 0 || spawnSync("pkg-config", ["--exists", "webkitgtk-6.0"]).status === 0;
if (process.platform === "linux" && !hasWebkit) {
  console.log("desktop coverage skipped: no WebKitGTK development package");
  process.exit(0);
}
const target = process.platform === "darwin" ? "mac-arm64" : process.platform === "win32" ? "win-x64" : "linux-x64";
const dir = shim(target);
const scriptc = join(light, "node_modules", ".bin", "scriptc");
const entry = "native/desktop/demo/backend.js";
const r = spawnSync(scriptc, ["coverage", entry, "--ffi", join(dir, "ffi.json"), "--fail-on=blockers"], { encoding: "utf8", cwd: light, timeout: 600000 });
const out = (r.stdout ?? "") + (r.stderr ?? "");
const statically = /compile statically\s+(\d+)\s+\((\d+)%\)/.exec(out);
const fully = /fully static/.test(out);
const deferred = /deferred to runtime/.test(out);
if (r.status === 0 && fully && !deferred) {
  console.log(`${entry}: fully static, ${statically ? statically[1] : "?"} statements, nothing deferred`);
  process.exit(0);
}
console.log(out);
console.log(`${entry}: ${r.status !== 0 ? "blockers" : !fully ? "a dynamic remainder" : "statements deferred to runtime"}`);
process.exit(1);
