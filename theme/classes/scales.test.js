import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./index.js";
import { buildTheme, isColorValue, themeColorVariables, themeFontSizes } from "./scales.js";
import { PALETTE } from "./palette.js";

test("a project's own colour tokens become utilities", () => {
  const colors = themeColorVariables({ color: { ink: "#131711", hero: "#282828" } });
  assert.equal(colors.ink, "var(--color-ink)");
  assert.equal(colors.hero, "var(--color-hero)");
});

test("the utility points at the variable, never the value, so dark mode still answers", () => {
  const colors = themeColorVariables({ color: { ink: "#131711" } });
  assert.ok(!colors.ink.includes("#131711"));
});

test("hyphenated tokens keep their whole name", () => {
  const colors = themeColorVariables({
    color: { "cat-strength": "#282828", "on-hero-muted": "rgba(255,255,255,0.62)" },
  });
  assert.equal(colors["cat-strength"], "var(--color-cat-strength)");
  assert.equal(colors["on-hero-muted"], "var(--color-on-hero-muted)");
});

test("translucent tokens are colours too", () => {
  const colors = themeColorVariables({ color: { scrim: "rgba(19,23,17,0.65)" } });
  assert.equal(colors.scrim, "var(--color-scrim)");
});

test("the text group contributes its colours", () => {
  const colors = themeColorVariables({ text: { muted: "#6e7169", disabled: "#a9aca3" } });
  assert.equal(colors.muted, "var(--text-muted)");
  assert.equal(colors.disabled, "var(--text-disabled)");
});

test("sizes and weights in the text group are not colours", () => {
  const colors = themeColorVariables({
    text: { muted: "#6e7169", xs: "0.75rem", base: "1rem", bold: "700" },
  });
  assert.deepEqual(Object.keys(colors), ["muted"]);
});

test("text.color is left to the framework's own `default` entry", () => {
  const colors = themeColorVariables({ text: { color: "#131711" } });
  assert.deepEqual(colors, {});
});

test("a name in both groups takes the color group, which is the palette", () => {
  const colors = themeColorVariables({
    color: { secondary: "#fe8019" },
    text: { secondary: "#3d413a" },
  });
  assert.equal(colors.secondary, "var(--color-secondary)");
});

test("an empty or absent theme asks for nothing", () => {
  assert.deepEqual(themeColorVariables(), {});
  assert.deepEqual(themeColorVariables({}), {});
  assert.deepEqual(themeColorVariables({ font: { size: "16px" } }), {});
});

test("the dark block is not a colour group, so it contributes no names of its own", () => {
  const colors = themeColorVariables({
    color: { ink: "#131711" },
    dark: { color: { ink: "#ffffff" } },
  });
  assert.deepEqual(Object.keys(colors), ["ink"]);
});

test("isColorValue reads the notations a theme actually uses", () => {
  for (const value of ["#fff", "#131711", "rgb(1,2,3)", "rgba(1,2,3,0.5)", "hsl(1 2% 3%)", "oklch(0.7 0.1 20)", "var(--x)"])
    assert.equal(isColorValue(value), true, value);
  for (const value of ["0.75rem", "700", "16px", "", "bold", null, undefined, 42, {}])
    assert.equal(isColorValue(value), false, String(value));
});

describe("buildTheme", () => {
  const project = {
    color: { ink: "#131711", hero: "#fabd2f" },
    shadow: { card: "4px 4px 0 0 #000", nav: "2px 2px 0 0 #000" },
    radius: { pill: "999px", card: "14px" },
    spacing: { gutter: "1.25rem" },
    leading: { article: "1.7" },
    font: { family: "Manrope", heading: "Archivo", google: ["Manrope"], size: "15px" },
  };
  const engine = createEngine({ theme: buildTheme(project) });

  it("project colours earn every colour utility", () => {
    assert.ok(engine.compile("text-ink").decls.includes("color:var(--color-ink)"));
    assert.ok(engine.compile("bg-hero").decls.includes("background-color:var(--color-hero)"));
    assert.ok(engine.compile("border-ink").decls.includes("border-color:var(--color-ink)"));
  });

  it("declared colours earn an on- companion pointing at the derived variable", () => {
    assert.ok(engine.compile("text-on-hero").decls.includes("color:var(--color-on-hero)"));
  });

  it("theme shadows become the shadow scale", () => {
    assert.deepEqual(engine.compile("shadow-card").decls, ["box-shadow:var(--shadow-card)"]);
  });

  it("theme radius becomes the rounded scale", () => {
    assert.deepEqual(engine.compile("rounded-pill").decls, ["border-radius:var(--radius-pill)"]);
  });

  it("theme spacing names join the numeric scale without displacing it", () => {
    assert.deepEqual(engine.compile("p-gutter").decls, ["padding:var(--spacing-gutter)"]);
    assert.deepEqual(engine.compile("p-4").decls, ["padding:1rem"]);
  });

  it("theme leading and font groups map through", () => {
    assert.deepEqual(engine.compile("leading-article").decls, ["line-height:var(--leading-article)"]);
    assert.deepEqual(engine.compile("font-heading").decls, ["font-family:var(--font-heading)"]);
  });

  it("framework tokens survive project merges", () => {
    assert.ok(engine.compile("bg-canvas").decls.includes("background-color:var(--canvas-background)"));
    assert.ok(engine.compile("text-muted").decls.includes("color:var(--text-muted)"));
  });
});

describe("palette opt-in", () => {
  it("is off by default and complete when passed", () => {
    const off = createEngine();
    assert.equal(off.compile("text-gray-400"), null);
    const on = createEngine({ theme: buildTheme({}, { palette: PALETTE }) });
    assert.deepEqual(on.compile("text-gray-400").decls, ["color:#9ca3af"]);
    assert.deepEqual(on.compile("bg-teal-300/50").decls,
      ["background-color:color-mix(in srgb, #5eead4 50%, transparent)"]);
  });

  it("theme tokens beat palette names on collision", () => {
    const engine = createEngine({
      theme: buildTheme({ color: { red: "#custom" } }, { palette: PALETTE }),
    });
    assert.deepEqual(engine.compile("text-red").decls, ["color:var(--color-red)"]);
    assert.deepEqual(engine.compile("text-red-500").decls, ["color:#ef4444"]);
  });
});

test("a theme's type scale drives the text-* utilities, pointing at the variable, and its colours stay out of it", () => {
  const sizes = themeFontSizes({ base: "0.875rem", "2xs": "0.625rem", color: "#f3efec", muted: "#887d76" });
  assert.deepEqual(sizes, { base: "var(--text-base)", "2xs": "var(--text-2xs)" });
  const theme = buildTheme({ text: { base: "0.875rem" } });
  assert.equal(theme.fontSize.base, "var(--text-base)");
  assert.deepEqual(theme.fontSize.xl, ["1.25rem", "1.75rem"], "a size the theme does not declare keeps the default");
});
