/**
 * @file @bootstrapp/light/env
 * What a component reads about the page it runs in: the viewport and its
 * breakpoint, the OS, touch, the color scheme, and the window when a desktop
 * shell gave the page one (`env.window`, null in a browser). Volatile values
 * are getters, always current on read; `subscribe` reports changes, and the
 * window host has a `subscribe` of its own for the window's state. Listeners
 * start with the first subscriber, so importing the module has no side
 * effects.
 */

/** @import { Env, EnvSnapshot, WindowHost } from "./types.js" */

export const BREAKPOINTS = { xs: 0, sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 };

/** @returns {EnvSnapshot["os"]} */
const detectOs = () => {
  const nav = globalThis.navigator;
  const s = `${nav?.userAgent || ""} ${/** @type {{ platform?: string } | undefined} */ (nav)?.platform || ""}`.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  if (/android/.test(s)) return "android";
  if (/mac/.test(s)) return "macos";
  if (/win/.test(s)) return "windows";
  if (/linux/.test(s)) return "linux";
  return "unknown";
};

/** @returns {WindowHost | null} */
const windowHost = () => {
  const host = /** @type {{ __desktopWindow?: unknown }} */ (globalThis).__desktopWindow;
  return typeof host === "object" && host !== null ? /** @type {WindowHost} */ (host) : null;
};

/** @param {number} w @returns {EnvSnapshot["breakpoint"]} */
const breakpointFor = (w) => {
  if (w >= BREAKPOINTS.xxl) return "xxl";
  if (w >= BREAKPOINTS.xl) return "xl";
  if (w >= BREAKPOINTS.lg) return "lg";
  if (w >= BREAKPOINTS.md) return "md";
  if (w >= BREAKPOINTS.sm) return "sm";
  return "xs";
};

const vw = () => globalThis.innerWidth || globalThis.document?.documentElement?.clientWidth || 0;
const vh = () => globalThis.innerHeight || globalThis.document?.documentElement?.clientHeight || 0;
/** @param {string} query */
const media = (query) => globalThis.matchMedia?.(query);
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** @type {Set<(snapshot: EnvSnapshot) => void>} */
const subscribers = new Set();
let listening = false;

/** @type {Env} */
export const env = {
  os: detectOs(),
  isTouch: (globalThis.navigator?.maxTouchPoints || 0) > 0 || "ontouchstart" in globalThis,
  get pixelRatio() { return globalThis.devicePixelRatio || 1; },
  get width() { return vw(); },
  get height() { return vh(); },
  get screenWidth() { return globalThis.screen?.width || vw(); },
  get screenHeight() { return globalThis.screen?.height || vh(); },
  get orientation() { return vh() >= vw() ? "portrait" : "landscape"; },
  get breakpoint() { return breakpointFor(vw()); },
  get isMobile() { return vw() < BREAKPOINTS.md; },
  get isDesktop() { return vw() >= BREAKPOINTS.md; },
  get prefersDark() { return !!media(DARK_QUERY)?.matches; },
  get dark() { return !!globalThis.document?.documentElement?.classList?.contains("dark"); },
  get window() { return windowHost(); },
  snapshot() {
    const { os, isTouch, pixelRatio, width, height, screenWidth, screenHeight, orientation, breakpoint, isMobile, isDesktop, prefersDark, dark } = env;
    return { os, isTouch, pixelRatio, width, height, screenWidth, screenHeight, orientation, breakpoint, isMobile, isDesktop, prefersDark, dark };
  },
  subscribe(fn) {
    listen();
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};

const notify = () => {
  const snapshot = env.snapshot();
  subscribers.forEach((fn) => {
    try { fn(snapshot); } catch (error) { reportError(error); }
  });
};

const listen = () => {
  if (listening || typeof globalThis.addEventListener !== "function") return;
  listening = true;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let debounce;
  globalThis.addEventListener("resize", () => {
    clearTimeout(debounce);
    debounce = setTimeout(notify, 150);
  }, { passive: true });
  globalThis.addEventListener("orientationchange", notify);
  media(DARK_QUERY)?.addEventListener?.("change", notify);
  const root = globalThis.document?.documentElement;
  if (!root || typeof MutationObserver !== "function") return;
  let wasDark = env.dark;
  new MutationObserver(() => {
    if (env.dark === wasDark) return;
    wasDark = env.dark;
    notify();
  }).observe(root, { attributes: true, attributeFilter: ["class"] });
};

export default env;
