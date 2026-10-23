/**
 * `<lc-search inline>`: the results live in the flow instead of a dropdown,
 * they stay while there is a query, and a click outside does not hide them.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import searchDef from "@bootstrapp/light/components/form/search.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();

describe("lc-search inline", () => {
  /** @type {any} */
  let el;

  before(async () => {
    define("lc-search", searchDef);
    el = document.createElement("lc-search");
    el.inline = true;
    el.docs = [{ id: "a", group: "Pages", title: "Alpha" }, { id: "b", group: "Pages", title: "Beta" }];
    document.body.appendChild(el);
    await rendered(el);
  });

  after(() => el.remove());

  it("lists matches in the flow as soon as there is a query", async () => {
    assert.equal(el.querySelector(".search-dropdown"), null);
    el.query = "al";
    await rendered(el);
    const panel = el.querySelector(".search-dropdown");
    assert.ok(panel, "the panel is rendered");
    assert.equal(getComputedStyle(panel).position, "static");
    assert.equal(panel.textContent.includes("Alpha"), true);
  });

  it("keeps the panel through a click outside", async () => {
    el.onClickOutside();
    await rendered(el);
    assert.ok(el.querySelector(".search-dropdown"));
  });
});
