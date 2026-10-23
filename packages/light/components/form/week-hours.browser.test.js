import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: hoursDef } = await import("./week-hours.js");
const { default: switchDef } = await import("./switch.js");
const { renderFormControl } = await import("./field-renderers.js");
const { render, html } = await import("@bootstrapp/light/html");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} [props] */
const mount = async (props = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-week-hours"));
  Object.assign(el, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

/** @param {any} el */
const settle = async (el) => {
  await tick();
  await el.$requestUpdate();
  await tick();
};

/** @param {any} el @param {number} day */
const row = (el, day) => el.querySelector(`[data-day="${day}"]`);

/** @param {HTMLInputElement} input @param {string} value */
const typeTime = (input, value) => {
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const BAR = [
  { days: [2, 3, 4], open: "18:00", close: "01:00" },
  { days: [5, 6], open: "18:00", close: "02:00" },
];

describe("@bootstrapp/light - lc-week-hours", () => {
  before(() => {
    if (!customElements.get("lc-switch")) View.define("lc-switch", switchDef);
    if (!customElements.get("lc-week-hours")) View.define("lc-week-hours", hoursDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws a row a day from Monday, the hours of an open one and Closed for the rest", async () => {
    const el = await mount({ value: BAR, locale: "en" });
    const days = [...el.querySelectorAll("[data-day]")].map((d) => Number(d.getAttribute("data-day")));
    assert.deepEqual(days, [1, 2, 3, 4, 5, 6, 0]);
    assert.equal(row(el, 1).querySelector("lc-switch").getAttribute("label"), "Monday");
    assert.equal(row(el, 1).querySelector("lc-switch").checked, false);
    assert.match(row(el, 1).textContent, /Closed/);
    assert.equal(row(el, 3).querySelector("[data-open]").value, "18:00");
    assert.equal(row(el, 6).querySelector("[data-close]").value, "02:00");
    assert.ok(row(el, 6).querySelector("[data-next-day]"), "closing after midnight says so");
    const sunday = await mount({ value: [], firstDay: 0 });
    assert.equal(sunday.querySelector("[data-day]").getAttribute("data-day"), "0");
  });

  it("opens a day with the hours of the nearest open day, and reports the week grouped", async () => {
    const el = await mount({ value: BAR });
    /** @type {unknown[]} */
    const changes = [];
    el.addEventListener("change", (/** @type {CustomEvent} */ e) => changes.push(e.detail.value));
    row(el, 1).querySelector("lc-switch").$emit("change", { checked: true });
    await settle(el);
    row(el, 0).querySelector("lc-switch").$emit("change", { checked: true });
    await settle(el);
    assert.deepEqual(changes.at(-1), [
      { days: [1, 2, 3, 4], open: "18:00", close: "01:00" },
      { days: [5, 6, 0], open: "18:00", close: "02:00" },
    ], "Monday has nothing before it in its week, so it takes Tuesday's; Sunday takes Saturday's");
    const empty = await mount({ value: [] });
    row(empty, 3).querySelector("lc-switch").$emit("change", { checked: true });
    await settle(empty);
    assert.deepEqual(empty.value, [{ days: [3], open: "09:00", close: "18:00" }], "with nothing open, a working day");
  });

  it("moves a day's hours, and closes it", async () => {
    const el = await mount({ value: BAR });
    typeTime(row(el, 4).querySelector("[data-close]"), "03:00");
    await settle(el);
    assert.deepEqual(el.value, [
      { days: [2, 3], open: "18:00", close: "01:00" },
      { days: [4], open: "18:00", close: "03:00" },
      { days: [5, 6], open: "18:00", close: "02:00" },
    ]);
    row(el, 2).querySelector("lc-switch").$emit("change", { checked: false });
    await settle(el);
    assert.match(row(el, 2).textContent, /Closed/);
    assert.deepEqual(el.value[0], { days: [3], open: "18:00", close: "01:00" });
  });

  it("keeps its own edits from reaching a form as a bare input's", async () => {
    const el = await mount({ value: BAR });
    let bare = 0;
    document.body.addEventListener("change", (e) => { if (e.target !== el) bare++; });
    typeTime(row(el, 3).querySelector("[data-open]"), "19:00");
    await settle(el);
    assert.equal(bare, 0);
  });

  it("is the control a form draws for a week-hours field", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    mounted.push(host);
    /** @type {unknown[]} */
    const seen = [];
    render(renderFormControl({ name: "hours", type: "array", cmsType: "week-hours", label: "Hours" }, BAR, (v) => seen.push(v), html), host);
    await tick();
    const el = /** @type {any} */ (host.querySelector("lc-week-hours"));
    await settle(el);
    assert.deepEqual(el.value, BAR);
    row(el, 1).querySelector("lc-switch").$emit("change", { checked: true });
    await settle(el);
    assert.deepEqual(seen.at(-1), [{ days: [1, 2, 3, 4], open: "18:00", close: "01:00" }, { days: [5, 6], open: "18:00", close: "02:00" }]);
  });
});
