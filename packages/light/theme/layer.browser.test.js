/**
 * The theme's CSS lives in the `light` cascade layer, so an app's own
 * unlayered `:root` tokens win over an applied preset while a preset still
 * wins over the static defaults in the layer.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyTheme, removeThemeCSS } from "@lightstart/light/theme";

const root = () => getComputedStyle(document.documentElement);

describe("theme layer", () => {
  it("lets a document stylesheet's :root token win over an applied preset, and a second preset still changes what it did not set", () => {
    const style = document.createElement("style");
    style.textContent = ":root { --canvas-background: #0f1115; }";
    document.head.append(style);
    try {
      applyTheme({ name: "first", canvas: { background: "#ffffff" }, color: { primary: "#111111" } });
      assert.equal(root().getPropertyValue("--canvas-background").trim(), "#0f1115");
      const primary = root().getPropertyValue("--color-primary").trim();

      applyTheme({ name: "second", canvas: { background: "#fefefe" }, color: { primary: "#ff0000" } });
      assert.equal(root().getPropertyValue("--canvas-background").trim(), "#0f1115");
      assert.notEqual(root().getPropertyValue("--color-primary").trim(), primary);
    } finally {
      style.remove();
      removeThemeCSS("dynamic-theme-vars");
      removeThemeCSS("lc-variant-rules");
      removeThemeCSS("dark-theme-vars");
    }
  });
});
