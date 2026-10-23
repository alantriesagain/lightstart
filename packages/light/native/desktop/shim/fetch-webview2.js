/**
 * @file Fetch the WebView2 SDK header the Windows build needs. The Microsoft.Web.WebView2
 * NuGet package is a zip; `WebView2.h` from its `build/native/include/` lands in
 * `native/desktop/out/win/include/`, where `build.js shim --target win` looks for it. The
 * runtime itself ships with Windows 10 and 11, so nothing else is bundled.
 * Run with `node native/desktop/shim/fetch-webview2.js [--version 1.0.2903.40]`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "out", "win");
const include = join(out, "include");
const at = process.argv.indexOf("--version");
const version = at >= 0 ? process.argv[at + 1] : "1.0.2903.40";
const url = `https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${version}`;
const archive = join(out, `webview2-${version}.zip`);
mkdirSync(include, { recursive: true });
const fetched = spawnSync("curl", ["-sSL", "-o", archive, url], { encoding: "utf8" });
if (fetched.status !== 0) {
  console.error(`could not download ${url}\n${fetched.stderr}`);
  process.exit(1);
}
const unpacked = spawnSync("unzip", ["-o", "-j", archive, "build/native/include/WebView2.h", "-d", include], { encoding: "utf8" });
if (unpacked.status !== 0 || !existsSync(join(include, "WebView2.h"))) {
  console.error(`could not extract WebView2.h from ${archive}\n${unpacked.stdout}${unpacked.stderr}`);
  process.exit(1);
}
rmSync(archive);
console.log(`WebView2.h ${version} in ${include}`);
