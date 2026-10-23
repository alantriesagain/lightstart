import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./index.js";
import { parseClass } from "./parse.js";

const engine = createEngine();
const one = (cls) => {
  const rule = engine.compile(cls);
  assert.ok(rule, `expected ${cls} to compile`);
  return rule;
};
const css = (cls) => {
  const rule = one(cls);
  return `${rule.selector}{${rule.decls.join(";")}}`;
};

describe("parser", () => {
  it("splits variants bracket-aware", () => {
    assert.deepEqual(parseClass("hover:sm:flex").variants, ["hover", "sm"]);
    assert.deepEqual(parseClass("[&:nth-child(2)]:underline").variants, ["[&:nth-child(2)]"]);
    assert.equal(parseClass("border-[length:3px]").base, "border-[length:3px]");
  });
  it("reads negatives, importance and modifiers", () => {
    const negative = parseClass("-mt-3");
    assert.equal(negative.negative, true);
    assert.equal(negative.base, "mt-3");
    assert.equal(parseClass("!text-primary").important, true);
    assert.equal(parseClass("hover:opacity-100!") && parseClass("opacity-100!").important, true);
    const modified = parseClass("text-default/70");
    assert.equal(modified.stem, "text-default");
    assert.equal(modified.modifier, "70");
  });
});

describe("spacing and sizing", () => {
  it("maps the numeric scale to quarter rems", () => {
    assert.equal(css("p-4"), ".p-4{padding:1rem}");
    assert.equal(css("gap-1.5"), ".gap-1\\.5{gap:0.375rem}");
    assert.equal(css("m-0"), ".m-0{margin:0px}");
  });
  it("expands sides and axes", () => {
    assert.equal(css("px-2"), ".px-2{padding-left:0.5rem;padding-right:0.5rem}");
    assert.equal(css("mt-1"), ".mt-1{margin-top:0.25rem}");
  });
  it("negates values including arbitraries", () => {
    assert.equal(css("-mt-3"), ".-mt-3{margin-top:-0.75rem}");
    assert.equal(css("-translate-y-0.5"),
      ".-translate-y-0\\.5{--tw-translate-y:-0.125rem;translate:var(--tw-translate-x, 0) var(--tw-translate-y, 0)}");
  });
  it("resolves fractions distinctly from modifiers", () => {
    assert.equal(css("w-1/2"), ".w-1\\/2{width:50%}");
    assert.equal(css("w-full"), ".w-full{width:100%}");
    assert.equal(css("h-screen"), ".h-screen{height:100vh}");
  });
  it("keeps arbitrary lengths and rejects colours in length slots", () => {
    assert.equal(css("min-w-[120px]"), ".min-w-\\[120px\\]{min-width:120px}");
    assert.equal(engine.compile("p-[#fff]"), null);
  });
});

describe("colors", () => {
  it("theme tokens point at variables", () => {
    assert.equal(css("text-muted"), ".text-muted{color:var(--text-muted)}");
    assert.equal(css("bg-surface-darker"), ".bg-surface-darker{background-color:var(--color-surface-darker)}");
    assert.equal(css("border-dim"), ".border-dim{border-color:var(--border-color)}");
    assert.equal(css("text-on-primary"), ".text-on-primary{color:var(--color-on-primary)}");
  });
  it("opacity modifiers become color-mix so var() tokens keep answering", () => {
    assert.equal(css("text-default/70"),
      ".text-default\\/70{color:color-mix(in srgb, var(--text-color) 70%, transparent)}");
  });
  it("raw palette classes are unknown until the palette is opted in", () => {
    assert.equal(engine.compile("text-gray-400"), null);
  });
  it("arbitrary colours pass through, including vars", () => {
    assert.equal(css("bg-[#282828]"), ".bg-\\[\\#282828\\]{background-color:#282828}");
    assert.equal(css("bg-[var(--color-accent)]"), ".bg-\\[var\\(--color-accent\\)\\]{background-color:var(--color-accent)}");
  });
});

describe("typography", () => {
  it("font sizes carry their line heights, overridable by modifier", () => {
    assert.equal(css("text-sm"), ".text-sm{font-size:0.875rem;line-height:1.25rem}");
    assert.equal(css("text-sm/6"), ".text-sm\\/6{font-size:0.875rem;line-height:1.5rem}");
    assert.equal(css("text-[11px]"), ".text-\\[11px\\]{font-size:11px}");
  });
  it("font resolves weight before family", () => {
    assert.equal(css("font-bold"), ".font-bold{font-weight:var(--font-bold, 700)}");
    assert.ok(css("font-mono").includes("font-family:ui-monospace"));
  });
});

describe("borders and effects", () => {
  it("bare border is one pixel; sides disambiguate width vs colour by value", () => {
    assert.equal(css("border"), ".border{border-width:1px}");
    assert.equal(css("border-t-2"), ".border-t-2{border-top-width:2px}");
    assert.equal(css("border-[length:3px]"), ".border-\\[length\\:3px\\]{border-width:3px}");
    assert.equal(css("border-primary"), ".border-primary{border-color:var(--color-primary)}");
  });
  it("shadows take the scale and arbitrary neobrutalist values", () => {
    assert.ok(css("shadow").includes("box-shadow:0 1px 3px"));
    assert.equal(css("shadow-[4px_4px_0px_0px_#000]"),
      ".shadow-\\[4px_4px_0px_0px_\\#000\\]{box-shadow:4px 4px 0px 0px #000}");
  });
  it("rings are a simplified single box-shadow with a colour var", () => {
    assert.ok(css("ring-2").includes("0 0 0 2px var(--tw-ring-color"));
    assert.equal(css("ring-primary"), ".ring-primary{--tw-ring-color:var(--color-primary)}");
  });
});

describe("variants", () => {
  it("pseudo classes append in order", () => {
    assert.equal(one("hover:bg-surface-light").selector, ".hover\\:bg-surface-light:hover");
    assert.equal(one("focus:outline-none").selector, ".focus\\:outline-none:focus");
  });
  it("dark targets the :root.dark class, matching the theme system", () => {
    assert.equal(one("dark:bg-black").selector, ":root.dark .dark\\:bg-black");
  });
  it("breakpoints become media queries and escape leading digits", () => {
    const rule = one("2xl:flex");
    assert.deepEqual(rule.medias, ["(min-width: 1536px)"]);
    assert.equal(rule.selector, ".\\32 xl\\:flex");
    assert.deepEqual(one("max-md:hidden").medias, ["(max-width: 767.98px)"]);
  });
  it("group and peer prefix ancestors", () => {
    assert.equal(one("group-hover:opacity-100").selector, ".group:hover .group-hover\\:opacity-100");
    assert.equal(one("peer-checked:block").selector, ".peer:checked ~ .peer-checked\\:block");
  });
  it("arbitrary variants substitute the ampersand", () => {
    assert.equal(one("[&:nth-child(2)]:underline").selector, ".\\[\\&\\:nth-child\\(2\\)\\]\\:underline:nth-child(2)");
  });
  it("stacked variants compose media and pseudo", () => {
    const rule = one("sm:hover:bg-primary");
    assert.deepEqual(rule.medias, ["(min-width: 640px)"]);
    assert.equal(rule.selector, ".sm\\:hover\\:bg-primary:hover");
  });
});

describe("conflict order", () => {
  it("shorthand rules sort before longhand so longhand wins", () => {
    assert.ok(one("p-4").order < one("px-2").order);
    assert.ok(one("m-2").order < one("mt-8").order);
    assert.ok(one("rounded-lg").order < one("rounded-t-none").order);
    assert.ok(one("border").order < one("border-t-2").order);
    assert.ok(one("inset-0").order < one("top-4").order);
  });
  it("generate emits shorthand before longhand regardless of input order", () => {
    const { css: out } = engine.generate(["px-2", "p-4"]);
    assert.ok(out.indexOf(".p-4{") < out.indexOf(".px-2{"));
  });
});

describe("output", () => {
  it("is deterministic and groups media queries", () => {
    const a = engine.generate(["sm:flex", "p-4", "hover:underline", "sm:gap-2"]).css;
    const b = engine.generate(["hover:underline", "sm:gap-2", "p-4", "sm:flex"]).css;
    assert.equal(a, b);
    assert.equal(a.match(/@media \(min-width: 640px\)/g).length, 1);
  });
  it("important marks every declaration", () => {
    assert.ok(engine.generate(["!truncate"]).css.includes("overflow:hidden !important"));
  });
  it("keyframes are emitted once ahead of the rules", () => {
    const out = engine.generate(["animate-spin", "sm:animate-spin"]).css;
    assert.equal(out.match(/@keyframes spin/g).length, 1);
    assert.ok(out.indexOf("@keyframes") < out.indexOf(".animate-spin"));
  });
  it("reports matched and unknown separately", () => {
    const { matched, unknown } = engine.generate(["flex", "sheet-banner", "text-gray-400"]);
    assert.deepEqual(matched, ["flex"]);
    assert.deepEqual(unknown, ["sheet-banner", "text-gray-400"]);
  });
  it("safelist classes are always generated", () => {
    const safeEngine = createEngine({ safelist: ["hidden"] });
    assert.ok(safeEngine.generate([]).css.includes(".hidden{display:none}"));
  });
});

describe("arbitrary properties", () => {
  it("compiles bracket-only tokens as declarations", () => {
    assert.equal(css("[--maps-zoom-top:4rem]"), ".\\[--maps-zoom-top\\:4rem\\]{--maps-zoom-top:4rem}");
    assert.equal(css("[mask-type:luminance]"), ".\\[mask-type\\:luminance\\]{mask-type:luminance}");
  });
});
