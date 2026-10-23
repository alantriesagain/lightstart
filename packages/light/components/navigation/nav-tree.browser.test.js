/**
 * `<lc-nav-tree>`: groups open and close, a long group folds behind "+N more",
 * and the active link is the one the page names.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import navItemDef from "@bootstrapp/light/components/navigation/nav-item.js";
import navTreeDef from "@bootstrapp/light/components/navigation/nav-tree.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("lc-nav-tree", () => {
  /** @type {any} */
  let el;

  before(async () => {
    define("lc-nav-item", navItemDef);
    define("lc-nav-tree", navTreeDef);
    el = document.createElement("lc-nav-tree");
    el.groups = [
      { id: "form", label: "Form", count: 4, items: ["Checkbox", "Input", "Select", "Switch"].map((label) => ({ label, href: `/components/form/${label.toLowerCase()}` })) },
      { id: "display", label: "Display", count: 1, items: [{ label: "Button", href: "/components/display/button" }] },
    ];
    el.open = ["form"];
    el.collapseAt = 2;
    el.active = "/components/form/input";
    document.body.appendChild(el);
    await rendered(el);
    await settle();
  });

  after(() => el.remove());

  it("shows an open group's first items and a count of the rest", () => {
    const items = [...el.querySelectorAll("lc-nav-item")].map((item) => item.label);
    assert.deepEqual(items, ["Checkbox", "Input"]);
    assert.match(el.querySelector(".nav-tree-more").textContent, /\+2 more/);
    assert.equal(el.querySelectorAll(".nav-tree-group[data-open]").length, 1);
  });

  it("marks the active link", () => {
    const active = [...el.querySelectorAll("lc-nav-item")].filter((item) => item.active);
    assert.deepEqual(active.map((item) => item.label), ["Input"]);
  });

  it("+N more shows the whole group", async () => {
    el.querySelector(".nav-tree-more").click();
    await rendered(el);
    await settle();
    assert.equal(el.querySelectorAll("lc-nav-item").length, 4);
    assert.equal(el.querySelector(".nav-tree-more"), null);
  });

  it("a group header opens and closes its group and says so", async () => {
    /** @type {any[]} */
    const toggles = [];
    el.addEventListener("nav-tree-toggle", (e) => toggles.push(e.detail));
    el.querySelectorAll(".nav-tree-head")[1].click();
    await rendered(el);
    await settle();
    assert.deepEqual(toggles, [{ id: "display", open: true }]);
    assert.equal(el.querySelectorAll("lc-nav-item").length, 5);
  });
});
