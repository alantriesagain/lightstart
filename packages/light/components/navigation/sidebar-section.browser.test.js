import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import sectionDef from "./sidebar-section.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();

describe("lc-sidebar-section", () => {
  /** @type {any} */
  let el;

  before(() => define("lc-sidebar-section", sectionDef));
  afterEach(() => el?.remove());

  const mount = async (attrs) => {
    el = document.createElement("lc-sidebar-section");
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    el.innerHTML = `<span class="child">Item</span><button slot="actions" class="act">+</button>`;
    document.body.appendChild(el);
    await rendered(el);
    return el;
  };

  it("toggles through its chevron button by default", async () => {
    await mount({ label: "Events", count: "3" });
    const toggles = [];
    el.addEventListener("toggle", (e) => toggles.push(e.detail));
    const button = el.querySelector("[part~=lc-sidebar-section-toggle]");
    assert.ok(button.querySelector("[part~=lc-sidebar-section-chevron]"));
    button.click();
    assert.deepEqual(toggles, [{ collapsed: true }]);
  });

  it("draws a plain label when static, with its count and actions and no toggle", async () => {
    await mount({ label: "Workspace", count: "2", static: "", collapsed: "" });
    const toggles = [];
    el.addEventListener("toggle", (e) => toggles.push(e.detail));
    const root = el;
    assert.equal(root.querySelector("[part~=lc-sidebar-section-toggle]"), null);
    assert.equal(root.querySelector("[part~=lc-sidebar-section-chevron]"), null);
    const heading = root.querySelector("[part~=lc-sidebar-section-heading]");
    assert.equal(heading.querySelector("[part~=lc-sidebar-section-label]").textContent.trim(), "Workspace");
    assert.equal(heading.querySelector("lc-badge").textContent.trim(), "2");
    assert.ok(root.querySelector('slot[name="actions"]'));
    heading.click();
    assert.deepEqual(toggles, []);
    assert.equal(root.querySelector("[part~=lc-sidebar-section-body]").hidden, false, "a static section never hides its body");
  });
});
