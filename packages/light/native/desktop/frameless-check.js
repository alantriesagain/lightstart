/**
 * @file The frameless window, checked by hand on a real display: builds the demo, opens it, and
 * drives the window the way a person would with XTest (`xte`), reading the result back from the X
 * server: a drag on the title bar moves the window by the pointer's travel, a click does not, a
 * double-click maximizes and restores, a drag in the right margin widens it, the minimize and
 * maximize buttons act, and the close button ends the program. Then the same demo with `--framed`
 * keeps the system title bar and hides the page's. It moves the real pointer, so it is not part
 * of `npm run verify`. Needs X11, `xte`, `wmctrl`, `xprop`, `xwininfo` and `import`.
 * Run with `node native/desktop/frameless-check.js`; screenshots land in `out/frameless-check/`.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.js";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "out", "frameless-check");
mkdirSync(shots, { recursive: true });
/** @type {string[]} */
const failures = [];

/**
 * @param {string} label
 * @param {boolean} ok
 * @param {string} [detail]
 */
const check = (label, ok, detail = "") => {
  if (!ok) failures.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  ${detail}` : ""}`);
};

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {string} cmd @param {string[]} args */
const out = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" }).stdout ?? "";

/** @param {string[]} commands */
const xte = (commands) => spawnSync("xte", commands);

/** @param {number} pid @returns {Promise<string>} the window id */
const windowOf = async (pid) => {
  for (let i = 0; i < 100; i++) {
    const line = out("wmctrl", ["-lp"]).split("\n").find((l) => l.split(/\s+/)[2] === String(pid));
    if (line) return line.split(/\s+/)[0];
    await sleep(100);
  }
  return "";
};

/** @param {string} id */
const geometry = (id) => {
  const info = out("xwininfo", ["-id", id]);
  /** @param {string} label */
  const read = (label) => Number.parseInt(info.match(new RegExp(`${label}:\\s+(-?\\d+)`))?.[1] ?? "0", 10);
  return { x: read("Absolute upper-left X"), y: read("Absolute upper-left Y"), w: read("Width"), h: read("Height") };
};

/** @param {string} id @param {string} name @returns {number[]} */
const extents = (id, name) => {
  const raw = out("xprop", ["-id", id, name]);
  return raw.includes("=") ? raw.split("=")[1].split(",").map((v) => Number.parseInt(v, 10)) : [0, 0, 0, 0];
};

/** @param {string} id */
const state = (id) => out("xprop", ["-id", id, "_NET_WM_STATE"]);

/** @param {string} id @param {string} file */
const shoot = (id, file) => {
  const g = geometry(id);
  spawnSync("import", ["-window", "root", "-crop", `${g.w + 40}x${g.h + 40}+${g.x - 20}+${g.y - 20}`, join(shots, file)]);
};

/**
 * @param {string} exe
 * @param {string[]} args
 */
const launch = (exe, args) => {
  const child = spawn(exe, args, { stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (/** @type {Buffer} */ chunk) => (log += String(chunk)));
  child.stderr.on("data", (/** @type {Buffer} */ chunk) => (log += String(chunk)));
  /** @type {Promise<number | null>} */
  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  return { child, exited, log: () => log };
};

const target = process.platform === "linux" ? "linux-x64" : process.platform === "darwin" ? "mac-arm64" : "win-x64";
const built = await build(join(here, "demo", "backend.js"), join(here, "demo", "web"), join(here, "out", target, "demo"), "demo", target, process.argv.includes("--keep-light"));

const frameless = launch(built.exe, []);
const id = await windowOf(frameless.child.pid ?? 0);
check("the window opened", id.length > 0);
if (id.length > 0) {
  await sleep(1500);
  spawnSync("wmctrl", ["-i", "-a", id]);
  await sleep(500);
  const ext = extents(id, "_GTK_FRAME_EXTENTS");
  check("client-side decorations, no window manager frame", ext.some((v) => v > 0) && extents(id, "_NET_FRAME_EXTENTS").every((v) => v === 0), `gtk ${ext.join(",")}`);
  shoot(id, "1-frameless.png");
  const bar = () => {
    const g = geometry(id);
    const [left, right, top] = extents(id, "_GTK_FRAME_EXTENTS");
    return { x: g.x + left + 220, y: g.y + top + 16, right: g.x + g.w - right };
  };
  /**
   * A control's centre on the screen, from where the page reported it: the controls sit at the
   * bar's right end, so the offset from the page's right edge holds at any window width.
   * @param {string} part
   */
  const control = (part) => {
    const g = geometry(id);
    const [left, right, top] = extents(id, "_GTK_FRAME_EXTENTS");
    const log = frameless.log();
    const width = Number(log.match(/controls width=(\d+)/)?.[1] ?? 0);
    const found = log.match(new RegExp(`${part}=(\\d+),(\\d+)`));
    const fromRight = width - Number(found?.[1] ?? width + 1000);
    return { x: g.x + g.w - right - fromRight, y: g.y + top + Number(found?.[2] ?? -1000), left };
  };

  let g0 = geometry(id);
  let b = bar();
  const travel = [];
  for (let i = 0; i < 12; i++) travel.push("mousermove 10 0", "usleep 30000");
  for (let i = 0; i < 5; i++) travel.push("mousermove 0 8", "usleep 30000");
  xte([`mousemove ${b.x} ${b.y}`, "mousedown 1", "usleep 100000", ...travel, "usleep 300000", "mouseup 1"]);
  await sleep(800);
  let g1 = geometry(id);
  check("a drag on the bar moves the window with the pointer", Math.abs(g1.x - g0.x - 120) <= 3 && Math.abs(g1.y - g0.y - 40) <= 3, `moved ${g1.x - g0.x},${g1.y - g0.y} for 120,40`);

  b = bar();
  xte([`mousemove ${b.x} ${b.y}`, "mouseclick 1", "usleep 300000", "mousermove 80 0", "usleep 300000"]);
  await sleep(600);
  const g2 = geometry(id);
  check("a click on the bar leaves the window where it is", g2.x === g1.x && g2.y === g1.y);

  b = bar();
  xte([`mousemove ${b.x} ${b.y}`, "mouseclick 1", "usleep 80000", "mouseclick 1"]);
  await sleep(1000);
  check("a double-click maximizes", state(id).includes("MAXIMIZED"));
  b = bar();
  xte([`mousemove ${b.x} ${b.y}`, "mouseclick 1", "usleep 80000", "mouseclick 1"]);
  await sleep(1000);
  check("a second double-click restores", !state(id).includes("MAXIMIZED"));

  g1 = geometry(id);
  const edge = g1.x + g1.w - extents(id, "_GTK_FRAME_EXTENTS")[1] + 2;
  xte([`mousemove ${edge} ${g1.y + Math.floor(g1.h / 2)}`, "usleep 200000", "mousedown 1", "usleep 150000", "mousermove 30 0", "usleep 60000", "mousermove 50 0", "usleep 300000", "mouseup 1"]);
  await sleep(800);
  g0 = geometry(id);
  check("a drag in the right margin widens the window", g0.w - g1.w >= 60, `width +${g0.w - g1.w}`);

  let at = control("maximize");
  xte([`mousemove ${at.x} ${at.y}`, "mouseclick 1"]);
  await sleep(1000);
  check("the maximize button maximizes", state(id).includes("MAXIMIZED"));
  shoot(id, "4-maximized.png");
  at = control("maximize");
  xte([`mousemove ${at.x} ${at.y}`, "mouseclick 1"]);
  await sleep(1000);
  check("the same button restores", !state(id).includes("MAXIMIZED"));

  at = control("minimize");
  xte([`mousemove ${at.x} ${at.y}`, "mouseclick 1"]);
  await sleep(1000);
  check("the minimize button minimizes", state(id).includes("HIDDEN"));
  spawnSync("wmctrl", ["-i", "-a", id]);
  await sleep(1000);

  const closeAt = control("close");
  xte([`mousemove ${closeAt.x} ${closeAt.y}`, "mouseclick 1"]);
  const code = await Promise.race([frameless.exited, sleep(3000).then(() => -1)]);
  check("the close button ends the program", code === 0, `exit ${String(code)}`);
}
frameless.child.kill();
check("the page saw a frameless window", frameless.log().includes("frameless=true"));

const framed = launch(built.exe, ["--framed"]);
const framedId = await windowOf(framed.child.pid ?? 0);
if (framedId.length > 0) {
  await sleep(1500);
  shoot(framedId, "3-framed.png");
  check("--framed keeps the window manager's frame", extents(framedId, "_NET_FRAME_EXTENTS").some((v) => v > 0));
  spawnSync("wmctrl", ["-i", "-c", framedId]);
  await Promise.race([framed.exited, sleep(3000)]);
}
framed.child.kill();
check("the page saw a framed window", framed.log().includes("frameless=false"));

console.log(failures.length === 0 ? "frameless ok" : `frameless check failed: ${failures.join("; ")}`);
console.log(`screenshots in ${shots}`);
process.exit(failures.length === 0 ? 0 : 1);
