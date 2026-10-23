import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: stripDef, stripDays, todayIn } = await import("./day-strip.js");

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
  const el = /** @type {any} */ (document.createElement("lc-day-strip"));
  Object.assign(el, props);
  const host = document.createElement("div");
  host.style.width = "360px";
  host.append(el);
  document.body.append(host);
  mounted.push(host);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

describe("@bootstrapp/light - lc-day-strip", () => {
  before(async () => {
    if (!customElements.get("lc-day-strip")) View.define("lc-day-strip", stripDef);
    await loadStyles("day-strip");
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("works the days out on the calendar, whatever the clock does", () => {
    const days = stripDays({ from: "2026-09-26", days: 3, locale: "en", today: "2026-09-27", dots: ["2026-09-28"] });
    assert.deepEqual(days.map((d) => d.date), ["2026-09-26", "2026-09-27", "2026-09-28"]);
    assert.deepEqual(days.map((d) => d.day), ["26", "27", "28"]);
    assert.deepEqual(days.map((d) => d.weekday), ["Sat", "Sun", "Mon"]);
    assert.deepEqual(days.map((d) => d.today), [false, true, false]);
    assert.deepEqual(days.map((d) => d.dot), [false, false, true]);
    assert.deepEqual(stripDays({ from: "junk", days: 3 }), []);
  });

  it("knows what day it is where the reader is asked to look", () => {
    const noon = Date.UTC(2026, 8, 27, 12, 0, 0);
    assert.equal(todayIn("America/Sao_Paulo", noon), "2026-09-27");
    assert.equal(todayIn("America/Sao_Paulo", Date.UTC(2026, 8, 28, 1, 0, 0)), "2026-09-27", "01:00 UTC is still the evening before in Rio");
    assert.equal(todayIn("Asia/Tokyo", Date.UTC(2026, 8, 27, 23, 0, 0)), "2026-09-28");
  });

  it("draws seven radios from the first day, the picked one checked and the marked ones dotted", async () => {
    const el = await mount({ from: "2026-09-26", value: "2026-09-27", dots: ["2026-09-28"], locale: "en" });
    const radios = [...el.querySelectorAll("[role=radio]")];
    assert.equal(radios.length, 7);
    assert.deepEqual(radios.map((r) => r.getAttribute("aria-checked")), ["false", "true", "false", "false", "false", "false", "false"]);
    assert.equal(radios[1].getAttribute("data-date"), "2026-09-27");
    assert.ok(radios[2].classList.contains("has-dot"));
    assert.ok(!radios[1].classList.contains("has-dot"));
    assert.ok(getComputedStyle(radios[2].querySelector(".day-strip-dot")).opacity === "1");
    assert.ok(getComputedStyle(radios[1].querySelector(".day-strip-dot")).opacity === "0");
  });

  it("says which day was picked, once, and not the one already picked", async () => {
    const el = await mount({ from: "2026-09-26", value: "2026-09-27" });
    /** @type {string[]} */
    const picked = [];
    el.addEventListener("change", (/** @type {Event} */ e) => picked.push(/** @type {CustomEvent<{ value: string }>} */ (e).detail.value));
    el.querySelector("[data-date='2026-09-29']").click();
    el.querySelector("[data-date='2026-09-29']").click();
    assert.deepEqual(picked, ["2026-09-29"]);
    assert.equal(el.value, "2026-09-29");
  });

  it("moves with the arrow keys and writes nothing when disabled", async () => {
    const el = await mount({ from: "2026-09-26", value: "2026-09-27" });
    el.querySelector(".day-strip-track").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    assert.equal(el.value, "2026-09-28");
    const off = await mount({ from: "2026-09-26", value: "2026-09-27", disabled: true });
    off.querySelector("[data-date='2026-09-29']").click();
    assert.equal(off.value, "2026-09-27");
  });
});
