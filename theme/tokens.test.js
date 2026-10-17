import assert from "node:assert/strict";
import test from "node:test";
import { cssColorToHex, darkSideOf, generateDarkTheme, generateThemeVariables, hslToRGB, isDarkBase, lightSideOf, parseColor, rgbToHex, variablesFor } from "./tokens.ts";
import defaultTheme from "./themes/default.js";
import gruvboxDark from "./themes/gruvbox-dark.js";

test("a CSS color resolves to six-digit hex, its alpha dropped", () => {
  assert.equal(cssColorToHex("#fff"), "#ffffff");
  assert.equal(cssColorToHex("#FFF8"), "#ffffff");
  assert.equal(cssColorToHex("#101210"), "#101210");
  assert.equal(cssColorToHex("#10121080"), "#101210");
  assert.equal(cssColorToHex("rgb(16, 18, 16)"), "#101210");
  assert.equal(cssColorToHex("rgba(255, 0, 0, 0.5)"), "#ff0000");
  assert.equal(cssColorToHex("hsl(120 50% 50%)"), "#40bf40");
  assert.equal(cssColorToHex("hsl(0 0% 100%)"), "#ffffff");
  assert.equal(cssColorToHex("transparent"), null);
  assert.equal(cssColorToHex("var(--color-primary)"), null);
  assert.equal(cssColorToHex("#12"), null);
});

test("hsl to rgb round-trips the hex a theme writes", () => {
  const hsl = parseColor("#e4572e");
  assert.ok(hsl !== null);
  const rgb = hslToRGB(hsl);
  const back = parseColor(rgbToHex(rgb[0], rgb[1], rgb[2]));
  assert.ok(back !== null);
  assert.deepEqual([back.h, back.s, back.l], [hsl.h, hsl.s, hsl.l]);
});

test("the sides of the default preset", () => {
  const light = variablesFor(defaultTheme, "light");
  const dark = variablesFor(defaultTheme, "dark");
  assert.equal(light["--color-primary"], "#101210");
  assert.equal(dark["--color-primary"], "#e9ebe8");
  assert.equal(light["--font-bold"], "700");
  assert.equal(dark["--font-bold"], "700");
  assert.equal(light["--text-muted"], "#6b716b");
  assert.ok(dark["--text-muted"] !== light["--text-muted"]);
  assert.equal(light["--color-on-primary"], "#ffffff");
  assert.ok(!("--dark-color-primary" in light));
});

test("a theme that is dark already is its own dark side", () => {
  assert.equal(isDarkBase(lightSideOf(gruvboxDark)), true);
  const dark = darkSideOf(gruvboxDark);
  assert.deepEqual(generateThemeVariables(dark), generateThemeVariables(lightSideOf(gruvboxDark)));
});

test("the derived dark side inverts neutrals and keeps hues", () => {
  const derived = generateDarkTheme({ canvas: { background: "#f3f4f2" }, color: { accent: "#e4572e" } });
  const canvas = parseColor(/** @type {string} */ (/** @type {Record<string, string>} */ (derived.canvas).background));
  const accent = parseColor(/** @type {string} */ (/** @type {Record<string, string>} */ (derived.color).accent));
  assert.ok(canvas !== null && canvas.l < 20);
  assert.ok(accent !== null && accent.h === 14);
});
