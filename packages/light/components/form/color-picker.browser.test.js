import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: pickerDef } = await import("./color-picker.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] @param {string[]} [swatches] */
const mount = async (attrs = {}, swatches = []) => {
  const el = /** @type {any} */ (document.createElement("lc-color-picker"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.swatches = swatches;
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {HTMLInputElement} input @param {string} value @param {string} [type] */
const type = (input, value, type = "input") => {
  input.value = value;
  input.dispatchEvent(new Event(type, { bubbles: true }));
};

describe("@bootstrapp/light - lc-color-picker", () => {
  before(() => {
    if (!customElements.get("lc-color-picker")) View.define("lc-color-picker", pickerDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("shows the value on the swatch and in the hex field, and a typed hex becomes the value", async () => {
    const el = await mount({ value: "#FF725E" });
    /** @type {string[]} */
    const seen = [];
    el.addEventListener("input", (/** @type {CustomEvent} */ e) => seen.push(`input:${e.detail.value}`));
    el.addEventListener("change", (/** @type {CustomEvent} */ e) => seen.push(`change:${e.detail.value}`));
    const hex = el.querySelector(".lc-color-picker-hex");
    assert.equal(hex.value, "#FF725E");
    assert.equal(el.querySelector(".lc-color-picker-native").value, "#ff725e");
    type(hex, "#abc");
    assert.equal(el.value, "#aabbcc", "a short spelling lands as six digits");
    type(hex, "#ab");
    assert.equal(el.value, "#aabbcc", "an incomplete spelling leaves the value alone");
    hex.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.deepEqual(seen, ["input:#aabbcc"], "Enter on an incomplete draft commits nothing new");
  });

  it("tracks alpha as two more digits only when asked, and swatches pick and mark themselves", async () => {
    const el = await mount({ value: "#1d2021", alpha: "" }, ["#ff725e", "#1d2021"]);
    const range = el.querySelector(".lc-color-picker-alpha");
    assert.equal(range.value, "100");
    type(range, "50", "change");
    assert.equal(el.value, "#1d202180");
    await el.$requestUpdate();
    assert.equal(el.querySelector(".lc-color-picker-percent").textContent.trim(), "50%");
    const chips = [...el.querySelectorAll(".lc-color-picker-chip")];
    assert.deepEqual(chips.map((c) => c.getAttribute("aria-selected")), ["false", "false"], "half-transparent is not the opaque swatch");
    chips[0].click();
    await el.$requestUpdate();
    assert.equal(el.value, "#ff725e", "a swatch without alpha picks the opaque colour");
    assert.equal(el.querySelector(".lc-color-picker-chip").getAttribute("aria-selected"), "true");
  });

  it("clears when allowed, and does nothing when disabled", async () => {
    const el = await mount({ value: "#ff725e", "allow-clear": "" });
    el.querySelector(".lc-color-picker-clear").click();
    await el.$requestUpdate();
    assert.equal(el.value, "");
    assert.equal(el.querySelector(".lc-color-picker-clear"), null, "nothing to clear once cleared");
    const locked = await mount({ value: "#ff725e", disabled: "" });
    type(locked.querySelector(".lc-color-picker-hex"), "#000000");
    assert.equal(locked.value, "#ff725e");
  });
});
