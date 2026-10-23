import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: rulerDef } = await import("./ruler.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {string} url */
const loadSheet = (url) => new Promise((resolve, reject) => {
  if (document.querySelector(`link[href="${url}"]`)) return resolve(undefined);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.onload = () => resolve(undefined);
  link.onerror = reject;
  document.head.append(link);
});

const ITEMS = ["1/30", "1/60", "1/125", "1/250", "1/500"];

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {HTMLElement & { items: string[], value: number, step: number, minor: number, $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-ruler"));
  el.style.width = "320px";
  el.items = ITEMS;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-ruler", () => {
  before(async () => {
    if (!customElements.get("lc-ruler")) View.define("lc-ruler", rulerDef);
    await loadSheet(new URL("./ruler.css", import.meta.url).href);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("prints every item once and marks the value", async () => {
    const el = await mount({ value: "2" });
    const labels = [...el.querySelectorAll("[part~=lc-ruler-text]")].map((n) => n.textContent);
    assert.deepEqual(labels, ITEMS);
    assert.equal(el.querySelector("[part~=lc-ruler-label].on [part~=lc-ruler-text]")?.textContent, "1/125");
    assert.equal(el.getAttribute("aria-valuenow"), "2");
    assert.equal(el.getAttribute("aria-valuetext"), "1/125");
  });

  it("slides the track one step per tick, the first tick half a step in", async () => {
    const el = await mount({ value: "0", step: "20", minor: "2" });
    assert.equal(el.style.getPropertyValue("--lc-ruler-offset"), "-10px");
    el.value = 2;
    await el.$requestUpdate();
    assert.equal(el.style.getPropertyValue("--lc-ruler-offset"), "-130px");
  });

  it("jumps on a tap, steps on the keys, and says so", async () => {
    const el = await mount({ value: "1" });
    /** @type {number[]} */
    const changes = [];
    el.addEventListener("change", (e) => changes.push(/** @type {CustomEvent<{ value: number }>} */ (e).detail.value));
    /** @type {HTMLButtonElement} */ (el.querySelectorAll("[part~=lc-ruler-label]")[3]).click();
    await el.$requestUpdate();
    assert.equal(el.value, 3);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await el.$requestUpdate();
    assert.equal(el.value, 2);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await el.$requestUpdate();
    assert.equal(el.value, 4);
    assert.deepEqual(changes, [3, 2, 4]);
  });

  it("stays put when disabled", async () => {
    const el = await mount({ value: "1", disabled: "" });
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await el.$requestUpdate();
    assert.equal(el.value, 1);
    assert.equal(el.tabIndex, -1);
  });
});
