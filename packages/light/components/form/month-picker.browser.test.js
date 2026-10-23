import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: pickerDef, monthDays, monthOf, shiftMonth } = await import("./month-picker.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @param {string[]} names */
const loadStyles = async (...names) => {
  const css = (await Promise.all(names.map(async (name) =>
    (await fetch(new URL(`./${name}.css`, import.meta.url))).text()))).join("\n");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  await tick();
};

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} [props] */
const mount = async (props = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-month-picker"));
  Object.assign(el, props);
  const host = document.createElement("div");
  host.style.width = "320px";
  host.append(el);
  document.body.append(host);
  mounted.push(host);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

/** @param {any} el @param {string} date */
const cell = (el, date) => /** @type {HTMLButtonElement} */ (el.querySelector(`[data-date='${date}']`));

describe("@bootstrapp/light - lc-month-picker", () => {
  before(async () => {
    if (!customElements.get("lc-month-picker")) View.define("lc-month-picker", pickerDef);
    await loadStyles("month-picker");
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("lays the month out as whole weeks from the day the week starts", () => {
    const { weekdays, days } = monthDays({ month: "2026-09", locale: "en", today: "2026-09-27", dots: ["2026-09-28"], min: "2026-09-19", from: "2026-09-26", to: "2026-09-29" });
    assert.equal(days.length, 35, "September 2026 needs five rows from a Monday");
    assert.equal(days[0].date, "2026-08-31", "the row starts on the Monday before");
    assert.deepEqual(days.slice(0, 2).map((d) => d.inMonth), [false, true]);
    assert.deepEqual(weekdays, ["M", "T", "W", "T", "F", "S", "S"]);
    const at = (/** @type {string} */ date) => days.find((d) => d.date === date);
    assert.equal(at("2026-09-27")?.today, true);
    assert.equal(at("2026-09-28")?.dot, true);
    assert.equal(at("2026-09-18")?.disabled, true, "before min is out of reach");
    assert.equal(at("2026-09-19")?.disabled, false);
    assert.deepEqual([at("2026-09-26")?.edge, at("2026-09-27")?.inside, at("2026-09-29")?.edge, at("2026-09-30")?.inside], [true, true, true, false]);
    assert.equal(monthDays({ month: "2026-09", weekStart: 0 }).days[0].date, "2026-08-30", "or the Sunday");
    assert.deepEqual(monthDays({ month: "junk" }), { weekdays: [], days: [] });
  });

  it("moves months by the calendar", () => {
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(monthOf("2026-09-27"), "2026-09");
  });

  it("picks one day and says so once", async () => {
    const el = await mount({ month: "2026-09", value: "2026-09-27", timezone: "UTC" });
    /** @type {string[]} */
    const picked = [];
    el.addEventListener("change", (/** @type {Event} */ e) => picked.push(/** @type {CustomEvent<{ value: string }>} */ (e).detail.value));
    assert.equal(el.querySelectorAll("[data-date]").length, 35);
    assert.equal(cell(el, "2026-09-27").getAttribute("aria-pressed"), "true");
    cell(el, "2026-09-29").click();
    cell(el, "2026-09-29").click();
    assert.deepEqual(picked, ["2026-09-29"]);
    assert.equal(el.value, "2026-09-29");
    await el.$requestUpdate();
    assert.equal(cell(el, "2026-09-29").getAttribute("aria-pressed"), "true");
    assert.equal(cell(el, "2026-09-27").getAttribute("aria-pressed"), "false");
  });

  it("picks a first and a last, swaps an earlier second tap, and starts over on a third", async () => {
    const el = await mount({ month: "2026-09", range: true, timezone: "UTC" });
    /** @type {Array<[string, string]>} */
    const picked = [];
    el.addEventListener("change", (/** @type {Event} */ e) => { const d = /** @type {CustomEvent<{ from: string, to: string }>} */ (e).detail; picked.push([d.from, d.to]); });
    cell(el, "2026-09-26").click();
    cell(el, "2026-09-29").click();
    await el.$requestUpdate();
    assert.deepEqual(picked, [["2026-09-26", ""], ["2026-09-26", "2026-09-29"]]);
    assert.ok(cell(el, "2026-09-27").classList.contains("is-inside"), "the days between are tinted");
    cell(el, "2026-09-10").click();
    assert.deepEqual([el.from, el.to], ["2026-09-10", ""], "a third tap starts over");
    cell(el, "2026-09-05").click();
    assert.deepEqual([el.from, el.to], ["2026-09-05", "2026-09-10"], "an earlier second tap becomes the first");
  });

  it("walks the months, and leaves a day before min alone", async () => {
    const el = await mount({ month: "2026-09", range: true, min: "2026-09-19", timezone: "UTC" });
    /** @type {string[]} */
    const months = [];
    el.addEventListener("month-change", (/** @type {Event} */ e) => months.push(/** @type {CustomEvent<{ month: string }>} */ (e).detail.month));
    assert.equal(cell(el, "2026-09-18").disabled, true);
    cell(el, "2026-09-18").click();
    assert.equal(el.from, "");
    /** @type {HTMLElement} */ (el.querySelector("[data-next]")).click();
    await el.$requestUpdate();
    assert.equal(el.querySelector("[data-month]")?.getAttribute("data-month"), "2026-10");
    /** @type {HTMLElement} */ (el.querySelector("[data-prev]")).click();
    assert.deepEqual(months, ["2026-10", "2026-09"]);
  });
});
