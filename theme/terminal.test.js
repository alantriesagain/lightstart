import assert from "node:assert/strict";
import test from "node:test";
import { STATE_FOCUS, STATE_FOCUS_WITHIN } from "../native/tui/classes.ts";
import { TerminalClasses } from "./terminal.ts";
import defaultTheme from "./themes/default.js";

const light = new TerminalClasses(defaultTheme, "light");
const dark = new TerminalClasses(defaultTheme, "dark");

/** @param {number} state */
const layer = (state) => (state === 0 ? "" : state === STATE_FOCUS ? "focus:" : state === STATE_FOCUS_WITHIN ? "focus-within:" : String(state) + ":");

/** @param {TerminalClasses} styler @param {string} classes the props by name, a state layer's prefixed with its variant, in the order they apply */
const propsOf = (styler, classes) => Object.fromEntries(styler.propsFor(classes).map((p) => [layer(p.state) + p.name, p.value]));

test("lengths round to cells, half a rem or eight pixels each, at least one when positive", () => {
  assert.equal(light.cellsOf("0"), 0);
  assert.equal(light.cellsOf("0.25rem"), 1);
  assert.equal(light.cellsOf("0.5rem"), 1);
  assert.equal(light.cellsOf("1rem"), 2);
  assert.equal(light.cellsOf("1.5rem"), 3);
  assert.equal(light.cellsOf("2.5rem"), 5);
  assert.equal(light.cellsOf("1px"), 1);
  assert.equal(light.cellsOf("16px"), 2);
  assert.equal(light.cellsOf("3ch"), 3);
  assert.equal(light.cellsOf("var(--spacing-md)"), 2);
  assert.equal(light.cellsOf("100%"), null);
  assert.equal(light.cellsOf("auto"), null);
  assert.equal(light.cellsOf("calc(100% - 1rem)"), null);
});

test("colors resolve through the tokens of the scheme", () => {
  assert.equal(light.colorOf("var(--color-primary)"), "#101210");
  assert.equal(dark.colorOf("var(--color-primary)"), "#e9ebe8");
  assert.equal(light.colorOf("var(--text-muted)"), "#6b716b");
  assert.equal(light.colorOf("color-mix(in srgb, var(--color-primary) 50%, transparent)"), "#101210");
  assert.equal(light.colorOf("var(--font-bold, 700)"), null);
  assert.equal(light.colorOf("var(--nope, #abcdef)"), "#abcdef");
  assert.equal(light.colorOf("transparent"), "default");
  assert.equal(light.colorOf("#fff"), "#ffffff");
  assert.equal(light.colorOf("var(--color-primary-light)"), light.colorOf("var(--color-primary-light)"));
  assert.match(String(light.colorOf("var(--color-primary-light)")), /^#[0-9a-f]{6}$/);
});

test("the mapping of the classes a terminal shows", () => {
  assert.deepEqual(propsOf(light, "flex-1 flex-row border p-1 gap-2 overflow-y-auto items-center w-10 h-3"), { flex: 1, direction: "row", border: true, padding: 1, gap: 1, scroll: true, align: "start", width: 5, height: 2 });
  assert.deepEqual(propsOf(light, "p-4 p-md px-2 gap-4"), { padding: 1, gap: 2 });
  assert.deepEqual(propsOf(light, "text-primary bg-surface font-bold italic underline opacity-50"), { fg: "#101210", bg: "#ffffff", bold: true, italic: true, underline: true, strike: false, dim: true });
  assert.deepEqual(propsOf(light, "line-through truncate"), { underline: false, strike: true, scroll: false, wrap: "none" });
  assert.deepEqual(propsOf(light, "hidden flex-none font-normal border-0 bg-transparent not-italic no-underline opacity-100 overflow-hidden"), { hidden: true, flex: 0, bold: false, border: false, bg: "default", italic: false, underline: false, strike: false, dim: false, scroll: false });
  assert.deepEqual(propsOf(light, "flex block grid items-end"), { align: "end" });
  assert.deepEqual(propsOf(light, "items-end items-stretch"), { align: "stretch" });
  assert.deepEqual(propsOf(light, "items-stretch items-end"), { align: "stretch" });
  assert.deepEqual(propsOf(light, "text-primary/50"), { fg: "#101210" });
  assert.deepEqual(propsOf(light, "w-full text-sm rounded m-2 border-dim shadow"), {});
});

test("later classes win, as in a stylesheet, and the last class of the same prop wins", () => {
  assert.deepEqual(propsOf(light, "p-4 p-1"), { padding: 1 });
  assert.deepEqual(propsOf(light, "p-1 p-4"), { padding: 2 });
  assert.deepEqual(propsOf(light, "font-bold font-normal"), { bold: false });
});

test("variants: dark: in the dark scheme alone; media queries and the states a terminal lacks never", () => {
  assert.deepEqual(propsOf(light, "dark:text-primary"), {});
  assert.deepEqual(propsOf(dark, "dark:text-primary"), { fg: "#e9ebe8" });
  assert.deepEqual(propsOf(dark, "text-muted dark:text-primary"), { fg: "#e9ebe8" });
  assert.deepEqual(propsOf(light, "md:flex-1 hover:underline sm:p-4 group-focus:font-bold active:underline"), {});
  assert.ok(light.ignored.has("md:flex-1") && light.ignored.has("hover:underline") && light.ignored.has("dark:text-primary") && light.ignored.has("group-focus:font-bold"));
});

test("focus: and focus-within: are state layers over the base, the base first", () => {
  assert.deepEqual(propsOf(light, "focus:font-bold text-muted focus:text-primary"), { fg: "#6b716b", "focus:bold": true, "focus:fg": "#101210" });
  assert.deepEqual(Object.keys(propsOf(light, "focus:font-bold text-muted focus:text-primary")), ["fg", "focus:fg", "focus:bold"]);
  assert.deepEqual(propsOf(light, "focus-within:bg-surface focus-visible:underline"), { "focus-within:bg": "#ffffff", "focus:underline": true, "focus:strike": false });
  assert.deepEqual(propsOf(light, "focus:p-4 focus:p-1"), { "focus:padding": 1 });
  assert.deepEqual(propsOf(dark, "dark:focus:text-primary focus:dark:text-muted"), { "focus:fg": "#7f857e" });
  assert.deepEqual(propsOf(light, "dark:focus:text-primary"), {});
  assert.deepEqual(propsOf(light, "focus:focus-within:underline"), { [String(STATE_FOCUS | STATE_FOCUS_WITHIN) + ":underline"]: true, [String(STATE_FOCUS | STATE_FOCUS_WITHIN) + ":strike"]: false });
  assert.ok(!light.ignored.has("focus:font-bold") && !light.ignored.has("focus-within:bg-surface"));
});

test("unknown and unshowable classes are ignored, listed, and never throw", () => {
  assert.deepEqual(propsOf(light, "nope-xyz flex-1 text-sm"), { flex: 1 });
  assert.ok(light.ignored.has("nope-xyz") && light.ignored.has("text-sm"));
  assert.ok(!light.ignored.has("flex-1"));
  assert.throws(() => new TerminalClasses(defaultTheme, "sepia"), /"light" or "dark"/);
});

test("a class string resolves once", () => {
  const first = light.propsFor("flex-1 border");
  assert.equal(light.propsFor("flex-1 border"), first);
});
