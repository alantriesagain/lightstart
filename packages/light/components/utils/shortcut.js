/**
 * A keyboard shortcut as text ("mod+k", "ctrl+shift+p") and the event that
 * matches it. `mod` is the platform's command key: ⌘ on a Mac, Ctrl elsewhere.
 * Pure: no DOM, no `$APP`.
 */

/** @typedef {{ key: string, mod: boolean, ctrl: boolean, meta: boolean, alt: boolean, shift: boolean }} Shortcut */

const MODIFIERS = new Set(["mod", "ctrl", "control", "meta", "cmd", "command", "alt", "option", "shift"]);

/**
 * @param {string} text
 * @returns {Shortcut}
 */
export const parseShortcut = (text) => {
  const parts = text.toLowerCase().split("+").map((part) => part.trim()).filter(Boolean);
  const shortcut = { key: "", mod: false, ctrl: false, meta: false, alt: false, shift: false };
  for (const part of parts)
    if (!MODIFIERS.has(part)) shortcut.key = part;
    else if (part === "mod") shortcut.mod = true;
    else if (part === "ctrl" || part === "control") shortcut.ctrl = true;
    else if (part === "meta" || part === "cmd" || part === "command") shortcut.meta = true;
    else if (part === "alt" || part === "option") shortcut.alt = true;
    else shortcut.shift = true;

  return shortcut;
};

/**
 * @param {{ key: string, ctrlKey: boolean, metaKey: boolean, altKey: boolean, shiftKey: boolean }} event
 * @param {Shortcut} shortcut
 */
export const matchesShortcut = (event, shortcut) => {
  if (!shortcut.key || event.key.toLowerCase() !== shortcut.key) return false;
  const command = event.metaKey || event.ctrlKey;
  if (shortcut.mod && !command) return false;
  if (!shortcut.mod && shortcut.ctrl !== event.ctrlKey) return false;
  if (!shortcut.mod && shortcut.meta !== event.metaKey) return false;
  return shortcut.alt === event.altKey && shortcut.shift === event.shiftKey;
};

/**
 * The keys to draw, in order, for the platform.
 * @param {Shortcut} shortcut
 * @param {string} os an `env.os` value (`@bootstrapp/light/env`)
 * @returns {string[]}
 */
export const shortcutKeys = (shortcut, os) => {
  const apple = os === "macos" || os === "ios";
  const keys = [];
  if (shortcut.mod) keys.push(apple ? "⌘" : "Ctrl");
  if (shortcut.ctrl) keys.push(apple ? "⌃" : "Ctrl");
  if (shortcut.alt) keys.push(apple ? "⌥" : "Alt");
  if (shortcut.shift) keys.push(apple ? "⇧" : "Shift");
  if (shortcut.meta) keys.push(apple ? "⌘" : "Win");
  keys.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return keys;
};
