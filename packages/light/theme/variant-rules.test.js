import assert from "node:assert/strict";
import test from "node:test";
import { generateThemeVariables, generateVariantRules } from "./index.js";

const varsFor = (color, lc) => generateThemeVariables({ color, ...(lc ? { lc } : {}) });

test("a palette colour carries the colour that can be read on it", () => {
  const vars = varsFor({ primary: "#fabd2f", ink: "#131711" });
  assert.equal(vars["--color-on-primary"], "#000000");
  assert.equal(vars["--color-on-ink"], "#ffffff");
});

test("a mid-tone takes whichever of black or white contrasts more", () => {
  const vars = varsFor({ secondary: "#fe8019", danger: "#d9564a", info: "#3a7bd5" });
  assert.equal(vars["--color-on-secondary"], "#000000");
  assert.equal(vars["--color-on-danger"], "#000000");
  assert.equal(vars["--color-on-info"], "#000000");
});

test("an on- colour the theme named is left alone", () => {
  const vars = varsFor({ primary: "#131711", "on-primary": "#fabd2f" });
  assert.equal(vars["--color-on-primary"], "#fabd2f");
});

test("a translucent or referenced colour gets no derived pair", () => {
  const vars = varsFor({ scrim: "rgba(19,23,17,0.65)", layer: "var(--color-ink)" });
  assert.equal(vars["--color-on-scrim"], undefined);
  assert.equal(vars["--color-on-layer"], undefined);
});

test("every palette colour is a button variant", () => {
  const css = generateVariantRules(varsFor({ primary: "#fabd2f", peach: "#f0a98e" }));
  assert.match(css, /lc-button\[variant="peach"\]/);
  assert.match(css, /--lc-button-background: var\(--color-peach\)/);
  assert.match(css, /--lc-button-color: var\(--color-on-peach\)/);
});

test("a shade is not a variant of its own", () => {
  const css = generateVariantRules(varsFor({ primary: "#fabd2f" }));
  assert.doesNotMatch(css, /variant="primary-dark"/);
});

test("a variant the theme spells out is bound to its own tokens", () => {
  const css = generateVariantRules(
    varsFor({ layer: "rgba(19,23,17,0.06)" }, { button: { "quiet-background": "var(--color-layer)", "quiet-color": "var(--text-color)" } }),
  );
  assert.match(css, /lc-button\[variant="quiet"\] \{\n {2}--lc-button-background: var\(--lc-button-quiet-background\);\n {2}--lc-button-color: var\(--lc-button-quiet-color\);/);
});

test("only what the theme declared is bound, so the rest of a variant survives", () => {
  const css = generateVariantRules(varsFor({}, { button: { "quiet-background": "var(--color-layer)" } }));
  assert.match(css, /--lc-button-background: var\(--lc-button-quiet-background\)/);
  assert.doesNotMatch(css, /--lc-button-border-color: var\(--lc-button-quiet-border-color\)/);
});

test("a spelled-out variant comes after the palette one, so it wins", () => {
  const css = generateVariantRules(
    varsFor({ secondary: "#fe8019" }, { button: { "secondary-background": "#131711" } }),
  );
  const palette = css.indexOf("var(--color-secondary)");
  const declared = css.indexOf("var(--lc-button-secondary-background)");
  assert.ok(palette !== -1 && declared !== -1, css);
  assert.ok(palette < declared, "the theme's own variant must come last");
});

test("a hover state is not mistaken for a variant", () => {
  const css = generateVariantRules(varsFor({}, { button: { "primary-hover-background": "#fcd475" } }));
  assert.doesNotMatch(css, /variant="primary-hover"/);
});
