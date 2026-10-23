import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: toolbarDef } = await import("./toolbar.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

const loadSheet = () => {
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = new URL("./toolbar.css", import.meta.url).href;
  const loaded = new Promise((resolve) => { sheet.onload = resolve; sheet.onerror = resolve; });
  document.head.append(sheet);
  return loaded;
};

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-toolbar"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.innerHTML = "<button>One</button><button>Two</button>";
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-toolbar", () => {
  before(async () => {
    if (!customElements.get("lc-toolbar")) View.define("lc-toolbar", toolbarDef);
    await loadSheet();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("lays its controls out in a row and says so to assistive tech", async () => {
    const el = await mount();
    assert.equal(getComputedStyle(el).display, "flex");
    assert.equal(getComputedStyle(el).flexDirection, "row");
    assert.equal(el.getAttribute("role"), "toolbar");
    assert.equal(el.getAttribute("aria-orientation"), "horizontal");
    assert.equal(el.children.length, 2, "the children it was given stay in place");
  });

  it("scrolls sideways on demand, and keeps the DOM's scroll method", async () => {
    const el = await mount({ scrollable: "" });
    assert.equal(getComputedStyle(el).overflowX, "auto");
    assert.equal(getComputedStyle(el).flexWrap, "nowrap");
    assert.equal(typeof el.scroll, "function", "the flag is not named after a method the element already has");
  });

  it("turns vertical, sets the button height for its size, and aligns as asked", async () => {
    const el = await mount({ vertical: "", size: "xs", align: "end" });
    assert.equal(getComputedStyle(el).flexDirection, "column");
    assert.equal(el.getAttribute("aria-orientation"), "vertical");
    assert.equal(getComputedStyle(el).getPropertyValue("--lc-button-height").trim(), "1.5rem");
    el.removeAttribute("vertical");
    await el.$requestUpdate();
    assert.equal(getComputedStyle(el).justifyContent, "flex-end");
  });
});
