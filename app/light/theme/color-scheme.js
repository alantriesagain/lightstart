/**
 * @file @bootstrapp/light/theme/color-scheme.js
 * The color scheme: the `dark` class on `<html>` that every theme's dark side
 * hangs off, the reader's stored choice, and the OS preference while they
 * have not made one.
 *
 * A page starts it once with the mode it declares: `"system"` follows the OS
 * until the reader chooses, `"dark"` starts dark, anything else starts light,
 * and a stored choice beats all three. Following the system never writes: a
 * stored value means the reader chose, so persisting an OS-derived one would
 * stop the page following the OS from the next visit on. The choice is stored
 * under `darkmode` as `"true"` or `"false"`, the literal a pre-paint script
 * can read before any module loads.
 */

import { signal } from "../signals/index.js";
import { env } from "../env/index.js";

const STORAGE_KEY = "darkmode";

/** @returns {boolean | null} */
const storedChoice = () => {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === null || value === undefined ? null : value === "true" || value === "1";
  } catch {
    return null;
  }
};

/** @type {(() => void) | null} */
let stopFollowing = null;

const apply = () => {
  globalThis.document?.documentElement.classList.toggle("dark", colorScheme.dark.value);
};

export const colorScheme = {
  dark: signal(false),
  followsSystem: false,
  /**
   * Start from the mode the page declares.
   * @param {string} [mode] `"system"`, `"dark"`, or anything else for light
   */
  start(mode) {
    stopFollowing?.();
    stopFollowing = null;
    const stored = storedChoice();
    colorScheme.followsSystem = mode === "system" && stored === null;
    colorScheme.dark.value = colorScheme.followsSystem ? env.prefersDark : stored === null ? mode === "dark" : stored;
    apply();
    if (colorScheme.followsSystem)
      stopFollowing = env.subscribe(({ prefersDark }) => {
        if (!colorScheme.followsSystem || colorScheme.dark.value === prefersDark) return;
        colorScheme.dark.value = prefersDark;
        apply();
      });
  },
  /**
   * Record the reader's choice; from here the page stops following the OS,
   * now and on every later visit.
   * @param {boolean} on
   */
  choose(on) {
    colorScheme.followsSystem = false;
    try { globalThis.localStorage?.setItem(STORAGE_KEY, String(on)); } catch {}
    colorScheme.dark.value = on;
    apply();
  },
  toggle() {
    colorScheme.choose(!colorScheme.dark.value);
  },
};

export default colorScheme;
