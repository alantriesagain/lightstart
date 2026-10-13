/**
 * @file The desktop gate: build the demo and run it with --smoke on the display, where the page
 * must connect, call a method and log through the bridge, after which the backend quits on its
 * own printing "smoke ok". Skipped, with a notice, when there is no display or no WebKitGTK.
 * Run with `node native/desktop/smoke.js`.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.js";

const here = dirname(fileURLToPath(import.meta.url));
const hasDisplay = Boolean(process.env.DISPLAY) || Boolean(process.env.WAYLAND_DISPLAY);
const hasWebkit = spawnSync("pkg-config", ["--exists", "webkit2gtk-4.1"]).status === 0 || spawnSync("pkg-config", ["--exists", "webkitgtk-6.0"]).status === 0;
if (process.platform === "linux" && (!hasDisplay || !hasWebkit)) {
  console.log(`desktop smoke skipped: ${hasDisplay ? "no WebKitGTK development package" : "no display"}`);
  process.exit(0);
}
const target = process.platform === "darwin" ? "mac-arm64" : process.platform === "win32" ? "win-x64" : "linux-x64";
const built = build(join(here, "demo", "backend.js"), join(here, "demo", "web"), join(here, "out", target, "demo"), "demo", target, process.argv.includes("--keep-light"));
const r = spawnSync(built.exe, ["--smoke"], { encoding: "utf8", timeout: 30000 });
const out = (r.stdout ?? "") + (r.stderr ?? "");
if (r.status === 0 && /^smoke ok$/m.test(r.stdout ?? "")) {
  console.log("smoke ok");
  process.exit(0);
}
console.log(out);
console.log(`desktop smoke failed (status ${String(r.status)}${r.signal ? ", signal " + r.signal : ""})`);
process.exit(1);
