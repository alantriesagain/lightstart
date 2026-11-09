import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";

const { default: inputDef } = await import("../form/input.js");
const { default: textareaDef } = await import("../form/textarea.js");
const { default: checkboxDef } = await import("../form/checkbox.js");
const { default: selectDef } = await import("../form/select.js");
const { default: numberInputDef } = await import("../form/number-input.js");
const { default: sliderDef } = await import("../form/slider.js");
const { default: switchDef } = await import("../form/switch.js");
const { default: radioDef } = await import("../form/radio.js");
const { default: radioGroupDef } = await import("../form/radio-group.js");
const { default: colorPickerDef } = await import("../form/color-picker.js");
const { default: labelDef } = await import("../form/label.js");
const { default: tagDef } = await import("../display/tag.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 */
const mount = async (tag, attrs = {}) => {
  const el = /** @type {HTMLElement & { $requestUpdate: () => Promise<unknown> }} */ (document.createElement(tag));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate?.();
  return el;
};

/** @param {Element} el */
const field = (el) => /** @type {HTMLInputElement} */ (el.querySelector("input.input"));

/** @param {Element} el */
const innerLabel = (el) => /** @type {HTMLLabelElement} */ (el.querySelector("lc-label > label"));

describe("@lightstart/light - withFormControl", () => {
  before(() => {
    View.define("lc-input", inputDef);
    View.define("lc-textarea", textareaDef);
    View.define("lc-checkbox", checkboxDef);
    View.define("lc-select", selectDef);
    View.define("lc-number-input", numberInputDef);
    View.define("lc-slider", sliderDef);
    View.define("lc-switch", switchDef);
    View.define("lc-radio", radioDef);
    View.define("lc-radio-group", radioGroupDef);
    View.define("lc-color-picker", colorPickerDef);
    View.define("lc-label", labelDef);
    View.define("lc-tag", tagDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("keeps the inner control's id distinct from the host id", async () => {
    const el = await mount("lc-input", { id: "x" });
    const inner = field(el);
    assert.equal(el.id, "x");
    assert.notEqual(inner.id, "x");
    assert.equal(document.querySelectorAll("#x").length, 1);
  });

  it("ties a label prop to the inner input", async () => {
    const el = await mount("lc-input", { id: "x", label: "Email" });
    const inner = field(el);
    const label = innerLabel(el);
    assert.equal(label.control, inner);
    label.click();
    assert.equal(document.activeElement, inner);
  });

  it("ties a label prop to the inner checkbox", async () => {
    const el = await mount("lc-checkbox", { id: "c", label: "Accept" });
    const box = /** @type {HTMLInputElement} */ (el.querySelector("input.checkbox"));
    const label = innerLabel(el);
    assert.equal(label.control, box);
    label.click();
    await tick();
    await el.$requestUpdate();
    assert.equal(el.checked, true);
    assert.equal(box.checked, true);
  });

  it("ties a label prop to the inner select", async () => {
    const el = await mount("lc-select", { id: "s", label: "Country", options: '["A","B"]' });
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    const label = innerLabel(el);
    assert.equal(label.control, select);
    label.click();
    assert.equal(document.activeElement, select);
  });

  it("lets a wrapping label find the inner input", async () => {
    const label = document.createElement("label");
    label.textContent = "Email ";
    document.body.append(label);
    mounted.push(label);
    const el = await mount("lc-input");
    label.append(el);
    const inner = field(el);
    assert.equal(label.control, inner);
    label.click();
    assert.equal(document.activeElement, inner);
  });

  it("lets a wrapping label find and toggle the inner checkbox", async () => {
    const label = document.createElement("label");
    label.textContent = "Accept ";
    document.body.append(label);
    mounted.push(label);
    const el = await mount("lc-checkbox");
    label.append(el);
    const box = /** @type {HTMLInputElement} */ (el.querySelector("input.checkbox"));
    assert.equal(label.control, box);
    label.click();
    await tick();
    await el.$requestUpdate();
    assert.equal(el.checked, true);
  });

  it("submits one native entry per named control", async () => {
    const form = document.createElement("form");
    document.body.append(form);
    mounted.push(form);

    const input = await mount("lc-input", { name: "text", value: "hello" });
    const textarea = await mount("lc-textarea", { name: "bio", value: "hi" });
    const checked = await mount("lc-checkbox", { name: "ok", checked: "" });
    const unchecked = await mount("lc-checkbox", { name: "flag" });
    const plain = /** @type {HTMLElement & { options: string[] }} */ (await mount("lc-select", { name: "country", value: "us" }));
    const searchable = /** @type {HTMLElement & { options: string[] }} */ (await mount("lc-select", { name: "city", searchable: "", value: "paris" }));
    const multiple = /** @type {HTMLElement & { options: string[], value: string[] }} */ (await mount("lc-select", { name: "langs", searchable: "", multiple: "" }));
    const number = await mount("lc-number-input", { name: "qty", value: "3" });
    const slider = await mount("lc-slider", { name: "vol", value: "50" });
    const toggle = await mount("lc-switch", { name: "notify", checked: "" });
    const radioGroup = await mount("lc-radio-group", { name: "plan", value: "pro" });
    const color = await mount("lc-color-picker", { name: "color", value: "#ff0000" });
    const anonymous = await mount("lc-input", { value: "hidden" });

    plain.options = ["us", "br"];
    searchable.options = ["paris", "rome"];
    multiple.options = ["pt", "en", "fr"];
    multiple.value = ["pt", "en"];
    radioGroup.append(document.createElement("lc-radio"), document.createElement("lc-radio"));
    const radios = [...radioGroup.querySelectorAll("lc-radio")];
    radios[0].setAttribute("value", "basic");
    radios[1].setAttribute("value", "pro");

    for (const el of [plain, searchable, multiple, radioGroup])
      await el.$requestUpdate?.();
    await tick();

    form.append(input, textarea, checked, unchecked, plain, searchable, multiple, number, slider, toggle, radioGroup, color, anonymous);

    const data = new FormData(form);
    assert.deepEqual(data.getAll("text"), ["hello"]);
    assert.deepEqual(data.getAll("bio"), ["hi"]);
    assert.deepEqual(data.getAll("ok"), ["on"]);
    assert.deepEqual(data.getAll("flag"), []);
    assert.deepEqual(data.getAll("country"), ["us"]);
    assert.deepEqual(data.getAll("city"), ["paris"]);
    assert.deepEqual(data.getAll("langs"), ["pt", "en"]);
    assert.deepEqual(data.getAll("qty"), ["3"]);
    assert.deepEqual(data.getAll("vol"), ["50"]);
    assert.deepEqual(data.getAll("notify"), ["on"]);
    assert.deepEqual(data.getAll("plan"), ["pro"]);
    assert.deepEqual(data.getAll("color"), ["#ff0000"]);
    assert.equal([...data].length, 12, "an unnamed, id-less control submits nothing");
  });
});
