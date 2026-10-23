import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: segmentedDef } = await import("./segmented.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday"].map((day) => ({ value: day, label: day.slice(0, 3) }));

/** @type {Element[]} */
const mounted = [];

/** @param {{ attrs?: Record<string, string>, options?: unknown[], values?: string[] }} [init] */
const mount = async ({ attrs = {}, options = DAYS, values } = {}) => {
  const el = /** @type {HTMLElement & { options: unknown[], value: string, values: string[], _pick: (value: string) => unknown, $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-segmented"));
  el.options = options;
  if (values) el.values = values;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {Element} el */
const buttons = (el) => /** @type {HTMLButtonElement[]} */ ([...el.querySelectorAll(".segmented-option")]);

/** @param {Element} el */
const selected = (el) => buttons(el).filter((button) => button.classList.contains("is-selected")).map((button) => button.textContent?.trim());

/** @param {Element} el */
const listen = (el) => {
  /** @type {Record<string, unknown>[]} */
  const seen = [];
  el.addEventListener("change", (e) => seen.push(/** @type {CustomEvent} */ (e).detail));
  return seen;
};

describe("@bootstrapp/light - lc-segmented", () => {
  before(() => {
    if (!customElements.get("lc-segmented")) View.define("lc-segmented", segmentedDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("picks one option as a radio group, and a second click on it emits nothing", async () => {
    const el = await mount({ attrs: { value: "Tuesday" } });
    const seen = listen(el);
    assert.equal(el.querySelector(".segmented-track")?.getAttribute("role"), "radiogroup");
    assert.deepEqual(buttons(el).map((button) => button.getAttribute("role")), ["radio", "radio", "radio", "radio"]);
    assert.deepEqual(buttons(el).map((button) => button.getAttribute("aria-checked")), ["false", "true", "false", "false"]);
    assert.ok(buttons(el).every((button) => !button.hasAttribute("aria-pressed")));
    buttons(el)[3].click();
    await el.$requestUpdate();
    assert.equal(el.value, "Thursday");
    assert.deepEqual(selected(el), ["Thu"]);
    buttons(el)[3].click();
    await el.$requestUpdate();
    assert.deepEqual(seen, [{ value: "Thursday" }]);
  });

  it("with multiple, toggles each option on its own as pressed buttons in a group", async () => {
    const el = await mount({ attrs: { multiple: "" }, values: ["Thursday"] });
    assert.equal(el.querySelector(".segmented-track")?.getAttribute("role"), "group");
    assert.ok(buttons(el).every((button) => !button.hasAttribute("role") && !button.hasAttribute("aria-checked")));
    assert.deepEqual(buttons(el).map((button) => button.getAttribute("aria-pressed")), ["false", "false", "false", "true"]);
    buttons(el)[0].click();
    await el.$requestUpdate();
    assert.deepEqual(el.values, ["Monday", "Thursday"]);
    assert.deepEqual(selected(el), ["Mon", "Thu"]);
    assert.deepEqual(buttons(el).map((button) => button.getAttribute("aria-pressed")), ["true", "false", "false", "true"]);
    buttons(el)[3].click();
    await el.$requestUpdate();
    assert.deepEqual(el.values, ["Monday"]);
    assert.deepEqual(selected(el), ["Mon"]);
    assert.equal(el.value, "", "multiple leaves value alone");
  });

  it("emits the toggled option and every option that is on, in the order of the options", async () => {
    const el = await mount({ attrs: { multiple: "" } });
    const seen = listen(el);
    buttons(el)[2].click();
    buttons(el)[0].click();
    buttons(el)[2].click();
    await el.$requestUpdate();
    assert.deepEqual(seen, [
      { value: "Wednesday", values: ["Wednesday"] },
      { value: "Monday", values: ["Monday", "Wednesday"] },
      { value: "Wednesday", values: ["Monday"] },
    ]);
  });

  it("does nothing while disabled", async () => {
    const el = await mount({ attrs: { multiple: "", disabled: "" } });
    const seen = listen(el);
    assert.ok(buttons(el).every((button) => button.disabled));
    el._pick("Tuesday");
    await el.$requestUpdate();
    assert.deepEqual(el.values, []);
    assert.deepEqual(seen, []);
  });

  it("draws an option's count after its label, and none for a zero", async () => {
    const el = await mount({ options: [{ value: "app", label: "App", count: 13 }, { value: "social", label: "Social", count: 0 }] });
    assert.deepEqual(buttons(el).map((button) => button.querySelector(".segmented-count")?.textContent ?? null), ["13", null]);
    assert.equal(buttons(el)[0].textContent?.replace(/\s+/g, ""), "App13");
  });
});
