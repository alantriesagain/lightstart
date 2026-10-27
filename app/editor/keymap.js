/**
 * Key names and keymaps. A binding is `"Mod-Shift-s"`; `Mod` is Meta on mac
 * and Ctrl elsewhere; single characters are matched case-insensitively.
 */

/** @import { Keymap, Platform } from "./types.js" */

const ORDER = ["Ctrl", "Alt", "Shift", "Meta"];

/** @type {Record<string, string>} */
const ALIASES = {
  control: "Ctrl",
  ctrl: "Ctrl",
  cmd: "Meta",
  command: "Meta",
  meta: "Meta",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  mod: "Mod",
};

/** @type {Record<string, string>} */
const KEY_ALIASES = {
  esc: "Escape",
  space: " ",
  return: "Enter",
  del: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

/**
 * @param {string} key
 * @returns {string}
 */
const normalizeKey = (key) => {
  const alias = KEY_ALIASES[key.toLowerCase()];
  if (alias) return alias;
  return key.length === 1 ? key.toLowerCase() : key;
};

/**
 * @returns {Platform}
 */
export const detectPlatform = () => {
  const nav = /** @type {{ platform?: string, userAgent?: string } | undefined} */ (globalThis.navigator);
  return /mac|iphone|ipad|ipod/i.test(nav?.platform || nav?.userAgent || "") ? "mac" : "other";
};

/**
 * @param {string} binding
 * @param {Platform} [platform]
 * @returns {string} canonical name
 */
export const normalizeBinding = (binding, platform = detectPlatform()) => {
  const parts = binding.split("-");
  if (binding.endsWith("--")) parts.splice(-2, 2, "-");
  const key = normalizeKey(parts.pop() ?? "");
  const mods = new Set();
  for (const part of parts) {
    const mod = ALIASES[part.toLowerCase()];
    if (!mod) throw new Error(`unknown modifier "${part}" in "${binding}"`);
    mods.add(mod === "Mod" ? (platform === "mac" ? "Meta" : "Ctrl") : mod);
  }
  return [...ORDER.filter((m) => mods.has(m)), key].join("-");
};

/**
 * @param {{ key: string, ctrlKey?: boolean, altKey?: boolean, shiftKey?: boolean, metaKey?: boolean }} event
 * @returns {string} canonical name
 */
export const keyName = (event) => {
  const mods = [];
  if (event.ctrlKey) mods.push("Ctrl");
  if (event.altKey) mods.push("Alt");
  if (event.shiftKey) mods.push("Shift");
  if (event.metaKey) mods.push("Meta");
  return [...mods, normalizeKey(event.key)].join("-");
};

/**
 * @template V
 * @param {Keymap<V>} bindings
 * @param {Platform} [platform]
 * @returns {Keymap<V>} keyed by canonical names
 */
export const normalizeKeymap = (bindings, platform = detectPlatform()) => {
  /** @type {Keymap<V>} */
  const out = {};
  for (const [binding, handler] of Object.entries(bindings)) out[normalizeBinding(binding, platform)] = handler;
  return out;
};

/**
 * First handler answering `true` wins; later keymaps take precedence.
 * @template V
 * @param {Keymap<V>[]} keymaps normalized
 * @param {string} name canonical
 * @param {V} view
 * @returns {boolean}
 */
export const runKeymap = (keymaps, name, view) => {
  for (let i = keymaps.length - 1; i >= 0; i--) {
    const handler = keymaps[i][name];
    if (handler && handler(view)) return true;
  }
  return false;
};
