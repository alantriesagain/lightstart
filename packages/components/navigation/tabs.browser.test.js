import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";

const { default: tabsDef } = await import("./tabs.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @typedef {HTMLElement & { $requestUpdate: () => Promise<void>, tabs: Array<{ id?: string, label: string, badge?: string, closable?: boolean }>, activeTab: number }} TabsElement */

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] @param {string} [inner] */
const mount = async (attrs = {}, inner = "") => {
  const el = /** @type {TabsElement} */ (document.createElement("lc-tabs"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.innerHTML = inner;
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

/** @param {TabsElement} el @param {Array<{ id?: string, label: string, badge?: string, closable?: boolean }>} tabs */
const setTabs = async (el, tabs) => {
  el.tabs = tabs;
  await el.$requestUpdate();
  await tick();
};

describe("@lightstart/light - lc-tabs", () => {
  before(async () => {
    const css = await (await fetch(new URL("./tabs.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    if (!customElements.get("lc-tabs")) View.define("lc-tabs", tabsDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("renders tabs from data and follows a new array", async () => {
    const el = await mount();
    await setTabs(el, [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta", badge: "2" },
    ]);

    let tabs = [...el.querySelectorAll("[data-lc-tab]")];
    assert.equal(tabs.length, 2);
    assert.equal(tabs[0].textContent.trim(), "Alpha");
    assert.equal(tabs[1].querySelector("[part~=lc-tabs-badge]").textContent.trim(), "2");
    assert.equal(tabs[0].getAttribute("role"), "tab");
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(tabs[1].getAttribute("aria-selected"), "false");

    await setTabs(el, [{ id: "c", label: "Gamma" }]);
    tabs = [...el.querySelectorAll("[data-lc-tab]")];
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].textContent.trim(), "Gamma");
  });

  it("emits tab-close from the close button without selecting the tab", async () => {
    const el = await mount();
    await setTabs(el, [
      { id: "a", label: "Alpha", closable: true },
      { id: "b", label: "Beta", closable: true },
    ]);

    /** @type {unknown} */
    let detail = null;
    let changes = 0;
    el.addEventListener("tab-close", (e) => { detail = /** @type {CustomEvent} */ (e).detail; });
    el.addEventListener("tab-change", () => changes++);

    const close = el.querySelectorAll("[part~=lc-tabs-item]")[1].querySelector("[part~=lc-tabs-close]");
    assert.equal(close?.getAttribute("aria-label"), "Close Beta");
    assert.equal(close?.getAttribute("tabindex"), "-1");
    assert.equal(el.querySelector("button button"), null);
    assert.equal(el.querySelector('[role="tab"] button'), null);
    close.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    assert.deepEqual(detail, { index: 1, id: "b" });
    assert.equal(changes, 0);
    assert.equal(el.activeTab, 0);
  });

  it("emits tab-close on Delete and on Backspace from a focused closable tab", async () => {
    const el = await mount();
    await setTabs(el, [
      { id: "a", label: "Alpha", closable: true },
      { id: "b", label: "Beta", closable: true },
    ]);

    /** @type {unknown[]} */
    const closes = [];
    el.addEventListener("tab-close", (e) => closes.push(/** @type {CustomEvent} */ (e).detail));

    const tab = el.querySelectorAll("[data-lc-tab]")[1];
    tab.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    tab.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));

    assert.deepEqual(closes, [
      { index: 1, id: "b" },
      { index: 1, id: "b" },
    ]);
  });

  it("emits tab-close on a middle-click over a closable tab", async () => {
    const el = await mount();
    await setTabs(el, [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta", closable: true },
    ]);

    /** @type {unknown} */
    let detail = null;
    el.addEventListener("tab-close", (e) => { detail = /** @type {CustomEvent} */ (e).detail; });

    el.querySelectorAll("[data-lc-tab]")[1].dispatchEvent(
      new MouseEvent("auxclick", { button: 1, bubbles: true }),
    );

    assert.deepEqual(detail, { index: 1, id: "b" });
  });

  it("emits tab-reorder from Alt+ArrowRight on a focused tab", async () => {
    const el = await mount({ reorderable: "" });
    await setTabs(el, [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" },
    ]);

    /** @type {unknown} */
    let detail = null;
    el.addEventListener("tab-reorder", (e) => { detail = /** @type {CustomEvent} */ (e).detail; });

    el.querySelectorAll("[data-lc-tab]")[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }),
    );

    assert.deepEqual(detail, { from: 1, to: 2, fromId: "b", toId: "c" });
  });

  it("emits tab-reorder after a pointer drag onto another tab", async () => {
    const el = await mount({ reorderable: "" });
    await setTabs(el, [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" },
    ]);

    /** @type {unknown} */
    let detail = null;
    el.addEventListener("tab-reorder", (e) => { detail = /** @type {CustomEvent} */ (e).detail; });

    const tabs = el.querySelectorAll("[data-lc-tab]");
    const first = tabs[0].getBoundingClientRect();
    const last = tabs[2].getBoundingClientRect();
    const startX = first.left + first.width / 2;
    const startY = first.top + first.height / 2;
    const endX = last.left + last.width / 2;
    const endY = last.top + last.height / 2;

    tabs[0].dispatchEvent(new PointerEvent("pointerdown", {
      button: 0,
      clientX: startX,
      clientY: startY,
      bubbles: true,
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      clientX: endX,
      clientY: endY,
      bubbles: true,
    }));
    window.dispatchEvent(new PointerEvent("pointerup", {
      clientX: endX,
      clientY: endY,
      bubbles: true,
    }));

    assert.deepEqual(detail, { from: 0, to: 2, fromId: "a", toId: "c" });
  });

  it("keeps slotted children working, without injecting a close button", async () => {
    const el = await mount(
      {},
      `
        <button slot="tab" value="one">One</button>
        <button slot="tab" value="two" closable>Two</button>
        <div slot="panel">One panel</div>
        <div slot="panel">Two panel</div>
      `,
    );

    const tabs = /** @type {HTMLElement[]} */ ([...el.querySelector("slot[name=tab]").children]);
    assert.equal(tabs.length, 2);
    assert.equal(tabs[0].getAttribute("role"), "tab");
    assert.equal(tabs[0].getAttribute("id").includes("-tab-0"), true);

    let changes = 0;
    el.addEventListener("tab-change", () => changes++);

    tabs[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(changes, 1);
    assert.equal(el.activeTab, 1);

    /** @type {unknown} */
    let detail = null;
    el.addEventListener("tab-close", (e) => { detail = /** @type {CustomEvent} */ (e).detail; });
    assert.equal(tabs[1].querySelector("[part~=lc-tabs-close]"), null);

    tabs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    assert.deepEqual(detail, { index: 1, id: "two" });

    tabs[1].dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    assert.deepEqual(detail, { index: 1, id: "two" });
  });
});
