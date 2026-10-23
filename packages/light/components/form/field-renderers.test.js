import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerFormFieldRenderer,
  getFormFieldRenderer,
} from "./field-renderers.js";

test("returns the registered renderer for a cms type", () => {
  const render = (field, value, onChange, html) => ({ field, value, onChange, html });
  registerFormFieldRenderer("richText", render);
  assert.equal(getFormFieldRenderer("richText"), render);
});

test("passes field, value, onChange and html through to the renderer", () => {
  const seen = [];
  registerFormFieldRenderer("media", (field, value, onChange, html) => {
    seen.push({ field, value, html });
    onChange("https://cdn.example/pic.png");
    return "rendered";
  });

  const field = { name: "cover", cmsType: "media" };
  const changes = [];
  const htmlTag = () => {};
  const out = getFormFieldRenderer("media")(field, "old", (v) => changes.push(v), htmlTag);

  assert.equal(out, "rendered");
  assert.deepEqual(seen, [{ field, value: "old", html: htmlTag }]);
  assert.deepEqual(changes, ["https://cdn.example/pic.png"]);
});

test("returns undefined for an unregistered type so callers can fall back", () => {
  assert.equal(getFormFieldRenderer("nope-not-registered"), undefined);
});

test("registering the same type again replaces the renderer", () => {
  const first = () => "first";
  const second = () => "second";
  registerFormFieldRenderer("seo", first);
  registerFormFieldRenderer("seo", second);
  assert.equal(getFormFieldRenderer("seo"), second);
});

test("a color field draws the color picker with its options as swatches", () => {
  const capture = (/** @type {TemplateStringsArray} */ strings, /** @type {unknown[]} */ ...values) => ({ markup: strings.join("|"), values });
  const out = /** @type {{ markup: string, values: unknown[] }} */ (getFormFieldRenderer("color")({ name: "accent", type: "color", options: ["#ff725e", "#ffbf3c"] }, "#ff725e", () => {}, /** @type {any} */ (capture)));
  assert.match(out.markup, /<lc-color-picker/);
  assert.ok(out.values.some((v) => Array.isArray(v) && v[0] === "#ff725e" && v[1] === "#ffbf3c"), "the options become swatches");
});
