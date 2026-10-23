import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: inputDef } = await import("./input.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {HTMLElement & { value: string, $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-input"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {Element} el */
const field = (el) => /** @type {HTMLInputElement} */ (el.querySelector("input.input"));

/** @param {Element} el @param {string} text */
const type = (el, text) => {
  field(el).value = text;
  field(el).dispatchEvent(new Event("input", { bubbles: true }));
};

describe("@bootstrapp/light - lc-input", () => {
  before(() => {
    if (!customElements.get("lc-input")) View.define("lc-input", inputDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws a prefix inside the field and keeps it out of the value", async () => {
    const el = await mount({ prefix: "@" });
    assert.equal(el.querySelector(".input-prefix")?.textContent, "@");
    type(el, "alanleal");
    assert.equal(el.value, "alanleal");
    const plain = await mount();
    assert.equal(plain.querySelector(".input-prefix"), null, "no prefix, no wrapper");
  });

  it("reports what is typed and emits input with it", async () => {
    const el = await mount({ placeholder: "Add a rule" });
    /** @type {string[]} */
    const seen = [];
    el.addEventListener("input", (e) => seen.push(/** @type {CustomEvent<{ value: string }>} */ (e).detail.value));
    type(el, "Quote prices in BRL.");
    assert.equal(el.value, "Quote prices in BRL.");
    assert.deepEqual(seen, ["Quote prices in BRL."]);
  });

  it("clears the field when the owner resets the value it typed", async () => {
    const el = await mount();
    type(el, "Name the place.");
    await el.$requestUpdate();
    el.value = "";
    await el.$requestUpdate();
    assert.equal(field(el).value, "", "a property binding reaches a field the user has typed in, an attribute would not");
    el.value = "Again";
    await el.$requestUpdate();
    assert.equal(field(el).value, "Again");
  });
});
