/**
 * The theme writes constructable sheets the document adopts, not `<style>` elements, so a strict
 * `style-src` holds. `injectThemeCSS(vars, id)` writes one under an id, a second write replaces it,
 * and `removeThemeCSS(id)` drops that sheet and leaves every other adopted sheet in place.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { injectThemeCSS, removeThemeCSS } from "@lightstart/light/theme";

const root = () => getComputedStyle(document.documentElement);

describe("theme sheets", () => {
  it("writes, replaces and removes a sheet by id, leaving other adopted sheets alone", () => {
    const other = new CSSStyleSheet();
    other.replaceSync(":root { --sheet-test-other: 1px; }");
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, other];

    injectThemeCSS({ "--sheet-test": "3px" }, "sheet-test");
    assert.equal(root().getPropertyValue("--sheet-test").trim(), "3px");
    assert.equal(document.getElementById("sheet-test"), null, "no <style> element");

    injectThemeCSS({ "--sheet-test": "5px" }, "sheet-test");
    assert.equal(root().getPropertyValue("--sheet-test").trim(), "5px");

    removeThemeCSS("sheet-test");
    assert.equal(root().getPropertyValue("--sheet-test").trim(), "");
    assert.equal(root().getPropertyValue("--sheet-test-other").trim(), "1px");

    removeThemeCSS("sheet-test");
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== other);
  });
});
