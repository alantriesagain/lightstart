import assert from "node:assert/strict";
import test from "node:test";
import { matchesShortcut, parseShortcut, shortcutKeys } from "./shortcut.js";

const event = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

test("mod is the command key on either platform", () => {
  const shortcut = parseShortcut("mod+k");
  assert.ok(matchesShortcut(event("k", { metaKey: true }), shortcut));
  assert.ok(matchesShortcut(event("K", { ctrlKey: true }), shortcut));
  assert.ok(!matchesShortcut(event("k"), shortcut));
  assert.ok(!matchesShortcut(event("k", { metaKey: true, shiftKey: true }), shortcut));
});

test("an explicit modifier is that modifier and no other", () => {
  const shortcut = parseShortcut("ctrl+shift+p");
  assert.ok(matchesShortcut(event("p", { ctrlKey: true, shiftKey: true }), shortcut));
  assert.ok(!matchesShortcut(event("p", { metaKey: true, shiftKey: true }), shortcut));
});

test("the keys drawn follow the platform", () => {
  assert.deepEqual(shortcutKeys(parseShortcut("mod+k"), "macos"), ["⌘", "K"]);
  assert.deepEqual(shortcutKeys(parseShortcut("mod+k"), "linux"), ["Ctrl", "K"]);
  assert.deepEqual(shortcutKeys(parseShortcut("alt+shift+escape"), "windows"), ["Alt", "Shift", "escape"]);
});
