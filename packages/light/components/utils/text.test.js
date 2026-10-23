import assert from "node:assert/strict";
import test from "node:test";
import en from "../../locales/en.js";
import { lcText } from "./text.js";

test("without an i18n host the English is what renders, interpolation included", () => {
  assert.equal(lcText("lc-modal", "close"), "Close");
  assert.equal(lcText("lc-form", "required", { label: "Email" }), "Email is required");
  assert.equal(lcText("lc-pagination", "pageOf", { current: 2, total: 9 }), "Page 2 of 9");
});

test("a param the string does not name is left alone, and an unknown key answers itself", () => {
  assert.equal(lcText("lc-pagination", "page", { nope: 1 }), "Page {page}");
  assert.equal(lcText("lc-modal", "nosuch"), "nosuch");
  assert.equal(lcText("no-such-tag", "close"), "close");
});

test("a copy prop that fell back to the locale file still lets a caller's own word win", () => {
  assert.equal(lcText("lc-wizard", "finish"), "Finish");
  assert.equal(lcText("lc-auth-form", "guest"), "Continue as Guest");
  assert.equal(lcText("lc-number-input", "raise", { label: "Quantity" }), "Raise Quantity");
});

test("every tag named in the locale files is a real component", async () => {
  const { default: pkg } = await import("../../package.json", { with: { type: "json" } });
  const tags = new Set(Object.keys(pkg.bootstrapp.components.lc).map((n) => `lc-${n}`));
  const own = new Set(["lc-chart", "lc-async", "lc-field", "lc-icon-picker"]);
  for (const tag of Object.keys(en))
    assert.ok(tags.has(tag) || own.has(tag), `${tag} names no component and is not a declared shared block`);
});
