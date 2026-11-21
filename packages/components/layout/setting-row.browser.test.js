import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";

const { default: settingRowDef } = await import("./setting-row.js");
const { default: switchDef } = await import("../form/switch.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {{ label?: string, description?: string, control?: string }} [opts] */
const mount = async (opts = {}) => {
  const el = /** @type {HTMLElement & { $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-setting-row"));
  if (opts.label !== undefined) el.setAttribute("label", opts.label);
  if (opts.description !== undefined) el.setAttribute("description", opts.description);
  const control = document.createElement(opts.control ?? "lc-switch");
  el.append(control);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  await tick();
  return { el, control: /** @type {HTMLElement & { checked: boolean }} */ (control) };
};

describe("@lightstart/light - lc-setting-row", () => {
  before(() => {
    if (!customElements.get("lc-switch")) View.define("lc-switch", switchDef);
    if (!customElements.get("lc-setting-row")) View.define("lc-setting-row", settingRowDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws the label and the description", async () => {
    const { el } = await mount({ label: "Notifications", description: "Mentions and replies" });
    assert.equal(el.querySelector("[part~=lc-setting-row-label]")?.textContent.trim(), "Notifications");
    assert.equal(el.querySelector("[part~=lc-setting-row-description]")?.textContent.trim(), "Mentions and replies");
  });

  it("points the control's aria-labelledby and aria-describedby at the row's text", async () => {
    const { el, control } = await mount({ label: "Notifications", description: "Mentions and replies" });
    const labelId = el.querySelector("[part~=lc-setting-row-label]")?.id;
    const descriptionId = el.querySelector("[part~=lc-setting-row-description]")?.id;

    assert.ok(labelId);
    assert.ok(descriptionId);
    assert.equal(control.getAttribute("aria-labelledby"), labelId);
    assert.equal(control.getAttribute("aria-describedby"), descriptionId);
  });

  it("leaves aria-describedby off a row that has no description", async () => {
    const { control } = await mount({ label: "Notifications" });
    assert.equal(control.hasAttribute("aria-describedby"), false);
    assert.ok(control.getAttribute("aria-labelledby"));
  });

  it("toggles a slotted switch when the label is clicked", async () => {
    const { el, control } = await mount({ label: "Notifications" });
    assert.equal(control.checked, false);

    el.querySelector("[part~=lc-setting-row-label]").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();

    assert.equal(control.checked, true);
  });
});
