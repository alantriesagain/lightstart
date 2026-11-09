import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";

const { default: inputDef } = await import("../form/input.js");
const { default: checkboxDef } = await import("../form/checkbox.js");
const { default: selectDef } = await import("../form/select.js");
const { default: labelDef } = await import("../form/label.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {string} tag @param {Record<string, string>} [attrs] */
const mount = async (tag, attrs = {}) => {
  const el = /** @type {HTMLElement & { $requestUpdate: () => Promise<unknown> }} */ (document.createElement(tag));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate?.();
  return el;
};

/** @param {string} tag @param {Record<string, string>} attrs */
const mountLabel = async (tag, attrs) => {
  const el = await mount(tag, attrs);
  await tick();
  return el;
};

/** @param {Element} el */
const field = (el) => /** @type {HTMLInputElement} */ (el.querySelector("input.input"));

describe("@lightstart/light - withFormControl", () => {
  before(() => {
    if (!customElements.get("lc-label")) View.define("lc-label", labelDef);
    if (!customElements.get("lc-input")) View.define("lc-input", inputDef);
    if (!customElements.get("lc-checkbox")) View.define("lc-checkbox", checkboxDef);
    if (!customElements.get("lc-select")) View.define("lc-select", selectDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("gives the inner control its own id, so the host id stays unique", async () => {
    const el = await mount("lc-input", { id: "x" });
    const inner = field(el);
    assert.equal(el.id, "x");
    assert.equal(inner.id, "x-control");
    assert.notEqual(inner.id, el.id);
    assert.equal(document.querySelectorAll("#x").length, 1);
  });

  it("focuses the inner input from an outside <label for> and names it", async () => {
    const label = await mountLabel("label", { for: "x" });
    label.textContent = "Email";
    const el = await mount("lc-input", { id: "x" });
    await el.$requestUpdate();
    const inner = field(el);
    assert.ok(label.id, "a label without an id gets one");
    assert.equal(inner.getAttribute("aria-labelledby"), label.id);
    label.click();
    assert.equal(document.activeElement, inner);
  });

  it("focuses the inner input from an outside <lc-label for> and names it", async () => {
    const outside = await mountLabel("lc-label", { for: "x", text: "Email" });
    const el = await mount("lc-input", { id: "x" });
    await el.$requestUpdate();
    const inner = field(el);
    const label = /** @type {HTMLLabelElement} */ (outside.querySelector("label"));
    assert.equal(inner.getAttribute("aria-labelledby"), label.id);
    label.click();
    assert.equal(document.activeElement, inner);
  });

  it("keeps the inner lc-label pointing at the inner control", async () => {
    const el = await mount("lc-input", { id: "x", label: "Email" });
    await tick();
    const inner = field(el);
    const label = /** @type {HTMLLabelElement} */ (el.querySelector("lc-label > label"));
    assert.equal(label.control, inner);
  });

  it("toggles a checkbox from an outside <label for>", async () => {
    const label = document.createElement("label");
    label.setAttribute("for", "c");
    label.textContent = "Accept";
    document.body.append(label);
    mounted.push(label);
    const el = await mount("lc-checkbox", { id: "c" });
    const box = /** @type {HTMLInputElement} */ (el.querySelector("input.checkbox"));
    label.click();
    await tick();
    await el.$requestUpdate();
    assert.equal(el.checked, true);
    assert.equal(box.checked, true);
  });

  it("focuses the inner select from an outside <label for>", async () => {
    const label = document.createElement("label");
    label.setAttribute("for", "s");
    label.textContent = "Country";
    document.body.append(label);
    mounted.push(label);
    const el = await mount("lc-select", { id: "s", options: '["A","B"]' });
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    label.click();
    assert.equal(document.activeElement, select);
  });

  it("generates an id when the host has none and still names the control", async () => {
    const el = await mount("lc-input", { label: "Email" });
    await tick();
    const inner = field(el);
    assert.ok(inner.id.startsWith("lc-form-"));
    assert.equal(inner.id, el.getInputId());
    const label = /** @type {HTMLLabelElement} */ (el.querySelector("lc-label > label"));
    assert.equal(label.control, inner);
  });
});
