import assert from "node:assert/strict";
import test from "node:test";
import { iconMaskCSS, maskDataUri, maskRule } from "./icon-mask.js";

/** @type {import("@bootstrapp/light/theme").IconEntry} */
const DOT = { body: `<circle cx="6" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="2"/>`, width: 24, height: 24 };

const CALENDAR = {
  body: `<path d="M8 2v3m8-3v3"/><rect width="18" height="18" x="3" y="3" rx="2"/>`,
  width: 24,
  height: 24,
};

test("a mask carries the shape and nothing that would fight the element", () => {
  const uri = maskDataUri(DOT);
  assert.ok(uri.startsWith("data:image/svg+xml,"), "percent-encoded, not base64");
  assert.ok(!/svg[^%]*width=/.test(uri), "the root carries no width to fight --lc-icon-size");
  assert.ok(uri.includes("viewBox='0 0 24 24'"), "mask-size: contain needs the viewBox");
  assert.ok(uri.includes("stroke-width='2'"), "but stroke-width is the shape, not the box");
  assert.ok(!uri.includes("currentColor"), "a standalone image has no element to resolve it against");
});

test("a sized shape keeps its size: the root is built, never stripped", () => {
  const uri = maskDataUri(CALENDAR);
  assert.ok(uri.includes("rect width='18' height='18'"),
    "the rect is the calendar body; without its size it paints nothing and the icon loses its border");
});

test("the root takes the size the icon declares, not a fixed 24", () => {
  const uri = maskDataUri({ ...DOT, width: 32, height: 16 });
  assert.ok(uri.includes("viewBox='0 0 32 16'"), "a set with its own box, or an icon overriding one");
});

test("the characters that would break a CSS url() are encoded", () => {
  const uri = maskDataUri(DOT);
  assert.ok(!uri.includes("<") && !uri.includes(">"), "angle brackets");
  assert.ok(!uri.includes('"'), "double quotes would close the url()");
  assert.ok(!/#[0-9a-f]/i.test(uri), "a bare # truncates the URI at the fragment");
  assert.ok(uri.includes("%3Csvg"), "and the svg is still there");
});

test("solid fills the paths the outline leaves open", () => {
  const outline = maskDataUri(DOT);
  const solid = maskDataUri(DOT, { solid: true });
  assert.notEqual(outline, solid);
  assert.ok(outline.includes("fill='none'"));
  assert.ok(!solid.includes("fill='none'"));
  assert.ok(solid.includes("fill='%23000'"));
});

test("a rule keys off the name attribute the markup already carries", () => {
  const rule = maskRule("route", DOT);
  assert.match(rule, /^:where\(\.lc-icon,lc-icon\)\[name="route"\]\{/, "the class form matters: renameCustomElements can rewrite the tag");
  assert.ok(rule.includes("--lc-icon-mask:url("));
  assert.ok(rule.includes("--lc-icon-paint:currentColor"), "so an unknown name stays transparent rather than painting a block");
});

test("the solid rule only overrides the mask, so colour is not restated", () => {
  const rule = maskRule("route", DOT, { solid: true });
  assert.ok(rule.includes('[name="route"][solid]'));
  assert.ok(!rule.includes("--lc-icon-paint"), "it inherits from the outline rule");
});

test("a name that is not an icon name yields no rule", () => {
  for (const name of ["🌴", "Route", "route.svg", "", "a b"])
    assert.equal(maskRule(name, DOT), "", `${JSON.stringify(name)} is not an icon name`);
});

test("an icon with no open paths has no solid rule: filled, it is the same shape", () => {
  assert.equal(maskRule("calendar", CALENDAR, { solid: true }), "");
  assert.notEqual(maskRule("calendar", CALENDAR), "", "the outline rule still draws it, [solid] or not");
});

test("a solid rule ships only for the names asked for", () => {
  const icons = [{ name: "route", entry: DOT }, { name: "heart", entry: DOT }];
  const css = iconMaskCSS(icons, { solid: new Set(["heart"]) });
  assert.equal(css.match(/--lc-icon-mask/g)?.length, 3, "two outlines, one solid");
  assert.ok(css.includes('[name="heart"][solid]'));
  assert.ok(!css.includes('[name="route"][solid]'));
  assert.equal(iconMaskCSS(icons).match(/--lc-icon-mask/g)?.length, 2, "none by default");
  assert.equal(iconMaskCSS(icons, { solid: "all" }).match(/--lc-icon-mask/g)?.length, 4);
  assert.equal(iconMaskCSS([]), "", "and nothing at all when there are no icons");
});

test("bold draws the strokes heavier and only overrides the mask", () => {
  assert.match(decodeURIComponent(maskDataUri(DOT, { bold: true })), /stroke-width='2\.5'/);
  assert.match(decodeURIComponent(maskDataUri(DOT)), /stroke-width='2'/, "the outline keeps its weight");
  const rule = maskRule("route", DOT, { bold: true });
  assert.ok(rule.startsWith(':where(.lc-icon,lc-icon)[name="route"][bold]{--lc-icon-mask:url('));
  assert.ok(!rule.includes("--lc-icon-paint"));
});

test("an icon with no strokes has no bold rule, and a bold rule ships only for the names asked for", () => {
  assert.equal(maskRule("calendar", CALENDAR, { bold: true }), "");
  const icons = [{ name: "route", entry: DOT }, { name: "heart", entry: DOT }];
  const css = iconMaskCSS(icons, { bold: new Set(["route"]) });
  assert.ok(css.includes('[name="route"][bold]'));
  assert.ok(!css.includes('[name="heart"][bold]'));
  assert.equal(iconMaskCSS(icons, { bold: "all" }).match(/\[bold\]/g)?.length, 2);
});
