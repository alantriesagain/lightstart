/**
 * @file The desktop shell's build tool. `shim` compiles webview and the shim into a static
 * archive for a target and writes the FFI manifest beside it; `smoke` builds the C smoke program
 * against that archive and runs it; `build` compiles an app's backend with scriptc against the
 * manifest (`compileBackend`) and stages its page, or with `--no-web` only the executable;
 * `run` builds then starts the app. Run with `node native/desktop/build.js <command> …` or
 * `light desktop <command> …`; works from the checkout and from the installed package.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptcPath } from "../scriptc.js";

const here = dirname(fileURLToPath(import.meta.url));
const light = join(here, "..", "..");
const shimDir = join(here, "shim");
const vendor = join(shimDir, "vendor", "webview");
const packModule = "../../scripts/pack.js";

/** @typedef {{ dir: string, manifest: { exports: Record<string, string | { types: string, default: string }> } }} Staged */

/**
 * Light's files as a page can load them: staged through scripts/pack.js in the checkout, or the
 * installed package itself, which is already that staging.
 * @param {boolean} keepLight reuse the previous staging
 * @returns {Promise<Staged>}
 */
const stageLight = async (keepLight) => {
  const dist = join(light, "dist");
  if (keepLight && existsSync(join(dist, "package.json"))) return { dir: dist, manifest: JSON.parse(readFileSync(join(dist, "package.json"), "utf8")) };
  if (!existsSync(join(light, "scripts", "pack.js"))) return { dir: light, manifest: JSON.parse(readFileSync(join(light, "package.json"), "utf8")) };
  const pack = /** @type {{ stage: () => Staged }} */ (await import(packModule));
  return pack.stage();
};

/** @param {string[]} args @param {string} name @param {string | null} fallback */
const option = (args, name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1] ?? fallback;
};

/** @param {string} cmd @param {string[]} cmdArgs @param {Record<string, string>} [env] */
const run = (cmd, cmdArgs, env) => {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", env: env ? { ...process.env, ...env } : process.env, stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(" ")} failed:\n${r.stdout ?? ""}${r.stderr ?? ""}`);
  return (r.stdout ?? "").trim();
};

/**
 * The pkg-config packages the Linux backend builds against, newest pair first.
 * @returns {string[]}
 */
const gtkPackages = () => {
  for (const pair of [["gtk4", "webkitgtk-6.0"], ["gtk+-3.0", "webkit2gtk-4.1"], ["gtk+-3.0", "webkit2gtk-4.0"]])
    if (spawnSync("pkg-config", ["--exists", ...pair]).status === 0) return pair;
  throw new Error("no WebKitGTK development package found; install libwebkit2gtk-4.1-dev (or webkitgtk-6.0) and gtk+-3.0");
};

/** @param {string} target */
const outDir = (target) => {
  const dir = join(here, "out", target);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const FUNCTIONS = [
  { name: "desktop_create", symbol: "desktop_create", params: ["i32", "i32"], returns: "pointer" },
  { name: "desktop_window", symbol: "desktop_window", params: ["pointer"], returns: "pointer" },
  { name: "desktop_set_title", symbol: "desktop_set_title", params: ["pointer", "string"], returns: "void" },
  { name: "desktop_set_size", symbol: "desktop_set_size", params: ["pointer", "i32", "i32", "i32"], returns: "void" },
  { name: "desktop_navigate", symbol: "desktop_navigate", params: ["pointer", "string"], returns: "void" },
  { name: "desktop_set_html", symbol: "desktop_set_html", params: ["pointer", "string"], returns: "void" },
  { name: "desktop_init", symbol: "desktop_init", params: ["pointer", "string"], returns: "void" },
  { name: "desktop_eval", symbol: "desktop_eval", params: ["pointer", "string"], returns: "void" },
  {
    name: "desktop_bind",
    symbol: "desktop_bind",
    params: ["pointer", "string", { callback: { id: "on_call", params: ["cstring", "cstring", { context: "on_call" }], returns: "void", lifetime: "retained" } }, { context: "on_call" }],
    returns: "i32",
  },
  { name: "desktop_unbind", symbol: "desktop_unbind", params: ["pointer", "string", { callback: { release: "desktop_bind:on_call" } }, { context: "desktop_bind:on_call" }], returns: "void" },
  { name: "desktop_return", symbol: "desktop_return", params: ["pointer", "string", "i32", "string"], returns: "void" },
  { name: "desktop_pump", symbol: "desktop_pump", params: ["pointer"], returns: "i32" },
  { name: "desktop_terminate", symbol: "desktop_terminate", params: ["pointer"], returns: "void" },
  { name: "desktop_destroy", symbol: "desktop_destroy", params: ["pointer"], returns: "void" },
  { name: "desktop_minimize", symbol: "desktop_minimize", params: ["pointer"], returns: "void" },
  { name: "desktop_maximize", symbol: "desktop_maximize", params: ["pointer", "i32"], returns: "void" },
  { name: "desktop_is_maximized", symbol: "desktop_is_maximized", params: ["pointer"], returns: "i32" },
  { name: "desktop_inspector", symbol: "desktop_inspector", params: ["pointer"], returns: "void" },
  { name: "desktop_begin_move", symbol: "desktop_begin_move", params: ["pointer", "i32", "i32"], returns: "void" },
  { name: "desktop_close", symbol: "desktop_close", params: ["pointer"], returns: "void" },
  { name: "desktop_window_state", symbol: "desktop_window_state", params: ["pointer"], returns: "i32" },
  { name: "desktop_message", symbol: "desktop_message", params: ["pointer", "string", "string"], returns: "void" },
  {
    name: "desktop_dialog_bind",
    symbol: "desktop_dialog_bind",
    params: ["pointer", { callback: { id: "on_dialog", params: ["i32", "i32", "cstring", { context: "on_dialog" }], returns: "void", lifetime: "retained" } }, { context: "on_dialog" }],
    returns: "i32",
  },
  { name: "desktop_dialog_unbind", symbol: "desktop_dialog_unbind", params: ["pointer", { callback: { release: "desktop_dialog_bind:on_dialog" } }, { context: "desktop_dialog_bind:on_dialog" }], returns: "void" },
  { name: "desktop_dialog_open", symbol: "desktop_dialog_open", params: ["pointer", "i32", "string", "string", "i32"], returns: "i32" },
  { name: "desktop_dialog_cancel", symbol: "desktop_dialog_cancel", params: ["pointer", "i32"], returns: "void" },
];

/**
 * Compile webview and the shim into `out/<target>/libdesktop.a` and write the manifest beside
 * it. Answers the target directory. Only the Linux target builds here; the others need their
 * platform's tools (see README.md).
 * @param {string} target
 */
export const shim = (target) => {
  const dir = outDir(target);
  const archive = join(dir, "libdesktop.a");
  /** @type {string[]} */
  let systemLibraries = [];
  /** @type {string[]} */
  let frameworks = [];
  /** @type {string[]} */
  let libraryPaths = [];
  if (target.startsWith("linux")) {
    const packages = gtkPackages();
    const cflags = run("pkg-config", ["--cflags", ...packages]).split(/\s+/).filter(Boolean);
    const libs = run("pkg-config", ["--libs", ...packages]).split(/\s+/).filter(Boolean);
    systemLibraries = [...libs.filter((f) => f.startsWith("-l")).map((f) => f.slice(2)), "stdc++", "dl", "pthread", "m"];
    const stdcxx = run("g++", ["-print-file-name=libstdc++.so"]);
    libraryPaths = [...libs.filter((f) => f.startsWith("-L")).map((f) => f.slice(2)), ...(stdcxx.includes("/") ? [dirname(stdcxx)] : [])];
    const common = ["-O2", "-fPIC", "-DWEBVIEW_STATIC", `-I${vendor}`, ...cflags];
    run("g++", ["-std=c++11", ...common, "-c", join(vendor, "webview.cc"), "-o", join(dir, "webview.o")]);
    run("cc", [...common, "-c", join(shimDir, "shim.c"), "-o", join(dir, "shim.o")]);
    run("ar", ["rcs", archive, join(dir, "webview.o"), join(dir, "shim.o")]);
  } else if (target.startsWith("mac")) {
    frameworks = ["WebKit", "Cocoa"];
    systemLibraries = ["c++"];
    const common = ["-O2", "-DWEBVIEW_STATIC", `-I${vendor}`];
    run("clang++", ["-std=c++11", ...common, "-c", join(vendor, "webview.cc"), "-o", join(dir, "webview.o")]);
    run("clang", [...common, "-c", join(shimDir, "shim.c"), "-o", join(dir, "shim.o")]);
    run("clang", ["-fobjc-arc", ...common, "-c", join(shimDir, "shim_mac.m"), "-o", join(dir, "shim_mac.o")]);
    run("ar", ["rcs", archive, join(dir, "webview.o"), join(dir, "shim.o"), join(dir, "shim_mac.o")]);
  } else if (target.startsWith("win")) {
    const include = join(here, "out", "win", "include");
    if (!existsSync(join(include, "WebView2.h"))) throw new Error("WebView2.h missing: run node native/desktop/shim/fetch-webview2.js first");
    systemLibraries = ["advapi32", "ole32", "shell32", "shlwapi", "user32", "version", "stdc++"];
    const common = ["-O2", "-DWEBVIEW_STATIC", "-DWEBVIEW_MSWEBVIEW2_BUILTIN_IMPL", `-I${vendor}`, `-I${include}`, "-target", "x86_64-windows-gnu"];
    run("zig", ["c++", "-std=c++14", ...common, "-c", join(vendor, "webview.cc"), "-o", join(dir, "webview.o")]);
    run("zig", ["cc", ...common, "-c", join(shimDir, "shim.c"), "-o", join(dir, "shim.o")]);
    run("zig", ["ar", "rcs", archive, join(dir, "webview.o"), join(dir, "shim.o")]);
  } else throw new Error(`unknown target ${target}`);
  const manifest = { ffi_format: 7, functions: FUNCTIONS, libraries: ["./libdesktop.a"], system_libraries: systemLibraries, frameworks };
  writeFileSync(join(dir, "ffi.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(dir, "library-paths.json"), `${JSON.stringify(libraryPaths)}\n`);
  return dir;
};

/**
 * Build the C smoke program against the archive and run it; with `--wait` the window stays until
 * the user closes it.
 * @param {string} target
 * @param {boolean} wait
 */
export const smoke = (target, wait) => {
  const dir = shim(target);
  const packages = gtkPackages();
  const cflags = run("pkg-config", ["--cflags", ...packages]).split(/\s+/).filter(Boolean);
  const libs = run("pkg-config", ["--libs", ...packages]).split(/\s+/).filter(Boolean);
  const exe = join(dir, "smoke");
  run("cc", ["-O2", ...cflags, "-c", join(shimDir, "smoke.c"), "-o", join(dir, "smoke.o")]);
  run("g++", [join(dir, "smoke.o"), join(dir, "libdesktop.a"), ...libs, "-ldl", "-lpthread", "-lm", "-o", exe]);
  const r = spawnSync(exe, wait ? ["--wait"] : [], { encoding: "utf8", env: { ...process.env, G_DEBUG: "fatal-criticals" } });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status !== 0 || wait) return r.status === 0;
  const frameless = spawnSync(exe, ["--frameless"], { encoding: "utf8", env: { ...process.env, G_DEBUG: "fatal-criticals" } });
  process.stdout.write(frameless.stdout ?? "");
  process.stderr.write(frameless.stderr ?? "");
  return frameless.status === 0;
};

/**
 * The newest modification time under `dir`, for deciding whether the archive is current.
 * @param {string} dir
 * @returns {number}
 */
const newest = (dir) => {
  let latest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    const time = entry.isDirectory() ? newest(file) : statSync(file).mtimeMs;
    if (time > latest) latest = time;
  }
  return latest;
};

/**
 * The shim archive for a target, rebuilt only when a shim source or the build script is newer.
 * @param {string} target
 */
const currentShim = (target) => {
  const dir = join(here, "out", target);
  const archive = join(dir, "libdesktop.a");
  if (existsSync(archive) && existsSync(join(dir, "ffi.json")) && statSync(archive).mtimeMs > Math.max(newest(shimDir), statSync(fileURLToPath(import.meta.url)).mtimeMs)) return dir;
  return shim(target);
};

/**
 * The import map a page gets: every entry of light's `exports` as a bare specifier under
 * `light/`, plus the prefix for anything else in the package.
 * @param {Record<string, string | { types: string, default: string }>} exports
 */
const importMap = (exports) => {
  /** @type {Record<string, string>} */
  const imports = {};
  for (const [key, target] of Object.entries(exports)) {
    const file = typeof target === "string" ? target : target.default;
    if (key === "./*") continue;
    imports["@bootstrapp/light" + key.slice(1)] = "light/" + file.replace(/^\.\//, "");
  }
  imports["@bootstrapp/light/"] = "light/";
  return { imports };
};

/**
 * Copy the files of the staged package that a page can load (scripts and styles) into `into`.
 * @param {string} from
 * @param {string} into
 */
const copyPage = (from, into) => {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") copyPage(source, join(into, entry.name));
    } else if (/\.(js|css)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      mkdirSync(into, { recursive: true });
      cpSync(source, join(into, entry.name));
    }
  }
};

/** What `build` answers: where the executable and the page landed. */
export class Built {
  /**
   * @param {string} exe
   * @param {string} web
   */
  constructor(exe, web) {
    this.exe = exe;
    this.web = web;
  }
}

/**
 * Compile `backend` with scriptc against the target's shim manifest into `exe`. `npmStatic` names
 * packages the backend imports bare (`@bootstrapp/light` for a backend outside this checkout).
 * @param {string} backend the backend's entry module
 * @param {string} exe the executable to write
 * @param {string} target
 * @param {string[]} npmStatic
 */
export const compileBackend = (backend, exe, target, npmStatic) => {
  const dir = currentShim(target);
  mkdirSync(dirname(exe), { recursive: true });
  /** @type {string[]} */
  const paths = JSON.parse(readFileSync(join(dir, "library-paths.json"), "utf8"));
  const libraryPath = [...paths, ...(process.env.LIBRARY_PATH ? [process.env.LIBRARY_PATH] : [])].join(":");
  const flags = npmStatic.flatMap((pkg) => ["--npm-static", pkg]);
  const r = spawnSync(scriptcPath(light), ["build", backend, "--ffi", join(dir, "ffi.json"), ...flags, "-o", exe, "--strip", "--no-keep-llvm"], {
    encoding: "utf8",
    env: { ...process.env, LIBRARY_PATH: libraryPath },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 900000,
  });
  if (r.status !== 0) throw new Error(`scriptc build ${backend} failed:\n${r.stdout ?? ""}${r.stderr ?? ""}`);
  return exe;
};

/**
 * Compile `backend` into `<out>/<name>` and stage its page: `<web>` copied to `<out>/web/`, light's
 * package files under `<out>/web/light/`, and `importmap.json` beside index.html. The executable
 * finds `web/` beside itself. With `noWeb` only the executable is built: the backend serves or
 * navigates to a page of its own.
 * @param {string} backend the backend's entry module
 * @param {string} web the directory holding index.html
 * @param {string} out the output directory
 * @param {string} name the executable's name
 * @param {string} target
 * @param {boolean} keepLight reuse light's staged files from a previous build instead of staging again
 * @param {boolean} [noWeb]
 * @param {string[]} [npmStatic]
 */
export const build = async (backend, web, out, name, target, keepLight, noWeb = false, npmStatic = []) => {
  const exe = compileBackend(backend, join(out, name), target, npmStatic);
  if (noWeb) return new Built(exe, "");
  const webOut = join(out, "web");
  const lightOut = join(webOut, "light");
  const staged = await stageLight(keepLight);
  if (existsSync(webOut))
    for (const entry of readdirSync(webOut, { withFileTypes: true }))
      if (entry.name !== "light") rmSync(join(webOut, entry.name), { recursive: true, force: true });
  cpSync(web, webOut, { recursive: true });
  rmSync(lightOut, { recursive: true, force: true });
  copyPage(staged.dir, lightOut);
  writeFileSync(join(webOut, "importmap.json"), `${JSON.stringify(importMap(staged.manifest.exports), null, 2)}\n`);
  return new Built(exe, webOut);
};

/** @param {string} target */
const defaultTarget = (target) => (target === "linux" ? "linux-x64" : target === "mac" ? "mac-arm64" : target === "win" ? "win-x64" : target);

/**
 * The command line: `shim`, `smoke`, `build` or `run` with their options; answers the exit code.
 * `light desktop …` and `node native/desktop/build.js …` both land here.
 * @param {string[]} argv
 */
export const desktop = async (argv) => {
  const [command, ...rest] = argv;
  const target = defaultTarget(option(rest, "target", "linux") ?? "linux");
  const dash = rest.indexOf("--");
  const own = dash >= 0 ? rest.slice(0, dash) : rest;
  const passthrough = dash >= 0 ? rest.slice(dash + 1) : [];
  if (command === "shim") {
    console.log(`archive and manifest in ${shim(target)}`);
    return 0;
  }
  if (command === "smoke") return smoke(target, own.includes("--wait")) ? 0 : 1;
  if ((command === "build" || command === "run") && own.length > 0) {
    const backend = resolve(own[0]);
    const web = resolve(option(own, "web", join(dirname(backend), "web")) ?? "");
    const name = option(own, "name", basename(backend).replace(/\.(js|ts)$/, "")) ?? "app";
    const out = resolve(option(own, "out", join(here, "out", target, name)) ?? "");
    const npmStatic = own.flatMap((arg, i) => (arg === "--npm-static" && i + 1 < own.length ? [own[i + 1]] : []));
    const built = await build(backend, web, out, name, target, own.includes("--keep-light"), own.includes("--no-web"), npmStatic);
    console.log(built.web.length > 0 ? `built ${relative(process.cwd(), built.exe)} with its page in ${relative(process.cwd(), built.web)}` : `built ${relative(process.cwd(), built.exe)}`);
    if (command !== "run") return 0;
    const app = spawnSync(built.exe, passthrough, { stdio: "inherit" });
    return app.status ?? 1;
  }
  console.log("usage: light desktop shim|smoke [--target linux|mac|win] [--wait]");
  console.log("       light desktop build|run <backend.js> [--web <dir>] [--out <dir>] [--name <app>] [--target …] [--keep-light] [--no-web] [--npm-static <pkg>] [-- <app args>]");
  return 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await desktop(process.argv.slice(2));
