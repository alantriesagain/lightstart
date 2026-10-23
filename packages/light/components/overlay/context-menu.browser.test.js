import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: menuDef } = await import("./context-menu.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

const mount = async () => {
  const el = /** @type {any} */ (document.createElement("lc-context-menu"));
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-context-menu", () => {
  before(() => {
    if (!customElements.get("lc-context-menu")) View.define("lc-context-menu", menuDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("opens at a point, groups its items, runs the picked action with the target and closes", async () => {
    const el = await mount();
    /** @type {unknown[]} */
    const picked = [];
    /** @type {unknown[]} */
    const selected = [];
    el.addEventListener("select", (/** @type {CustomEvent} */ e) => selected.push(e.detail.item.label));
    el.openAt(24, 16, {
      items: [
        { label: "Rename", icon: "pencil", action: (/** @type {unknown} */ t) => picked.push(["rename", t]) },
        { label: "Delete", group: "9_danger", danger: true, action: (/** @type {unknown} */ t) => picked.push(["delete", t]) },
      ],
      target: { id: 7 },
    });
    await tick();
    await el.$requestUpdate();
    assert.equal(el.hasAttribute("data-open"), true);
    assert.equal(el.style.left, "24px");
    assert.equal(el.style.top, "16px");
    const rows = [...el.querySelectorAll(".lc-context-menu-row")];
    assert.deepEqual(rows.map((r) => r.querySelector(".lc-context-menu-label")?.textContent?.trim()), ["Rename", "Delete"]);
    assert.equal(el.querySelectorAll('li[role="separator"]').length, 1, "the two groups are separated");
    assert.ok(el.querySelector("li.is-danger"), "the danger item is marked");
    rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    assert.deepEqual(picked, [["delete", { id: 7 }]]);
    assert.deepEqual(selected, ["Delete"]);
    assert.equal(el.hasAttribute("data-open"), false, "picking closes the menu");
  });

  it("opens beside an element and closes on Escape", async () => {
    const el = await mount();
    const anchor = document.createElement("button");
    anchor.style.cssText = "position:fixed;left:20px;top:40px;width:32px;height:32px";
    document.body.append(anchor);
    mounted.push(anchor);
    el.openFor(anchor, { items: [{ label: "One", action: () => {} }] });
    await tick();
    await el.$requestUpdate();
    await tick();
    assert.equal(el.hasAttribute("data-open"), true);
    const rect = el.getBoundingClientRect();
    assert.ok(Math.abs(rect.left - 20) < 2, `the menu's left edge sits at the anchor's left edge, got ${rect.left}`);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await tick();
    assert.equal(el.hasAttribute("data-open"), false);
  });

  it("a submenu parent renders its children in a panel and is not picked itself", async () => {
    const el = await mount();
    let ran = false;
    el.openAt(10, 10, { items: [{ label: "More", children: [{ label: "Child", action: () => { ran = true; } }] }] });
    await tick();
    await el.$requestUpdate();
    const parent = el.querySelector(".lc-context-menu-parent");
    assert.ok(parent, "the parent row is there");
    assert.equal(parent.querySelectorAll(".lc-context-menu-submenu .lc-context-menu-row").length, 1);
    parent.querySelector(".lc-context-menu-row").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    assert.equal(ran, false);
    assert.equal(el.hasAttribute("data-open"), true, "clicking a parent keeps the menu open");
  });
});
