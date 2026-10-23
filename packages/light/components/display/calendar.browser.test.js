import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";

const { default: calendarDef, localDateKey, weekDaysOf } = await import("./calendar.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = async (props) => {
  const el = /** @type {any} */ (document.createElement("lc-calendar"));
  Object.assign(el, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return { el, root: el };
};

const WEDNESDAY = "2026-09-23";
const EVENTS = [
  { id: "a", title: "Standup", date: "2026-09-21", time: "09:00" },
  { id: "b", title: "Launch", date: WEDNESDAY, time: "14:00" },
  { id: "c", title: "Next week", date: "2026-09-28" },
];

describe("@bootstrapp/light - lc-calendar week view", () => {
  before(async () => {
    if (!customElements.get("lc-calendar")) View.define("lc-calendar", calendarDef);
    const css = await (await fetch(new URL("./calendar.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("finds the Sunday-first week around a date", () => {
    const week = weekDaysOf(new Date(2026, 8, 23));
    assert.deepEqual(week.map(localDateKey), [
      "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26",
    ]);
  });

  it("lists the seven days of the selected week, each with its own events", async () => {
    const { root } = await mount({ events: EVENTS, viewMode: "week", selectedDate: WEDNESDAY });
    const rows = [...root.querySelectorAll("[part~=lc-calendar-week-day]")];
    assert.equal(rows.length, 7);
    assert.deepEqual(rows.map((row) => row.dataset.date), weekDaysOf(new Date(2026, 8, 23)).map(localDateKey));
    const numeral = rows[3].querySelector("[part~=lc-calendar-day-number]");
    assert.equal(numeral.textContent.trim(), "23");
    assert.equal(getComputedStyle(numeral).fontSize, "72px");
    assert.equal(getComputedStyle(numeral).fontWeight, "700");
    assert.equal(rows[3].querySelector("[part~=lc-calendar-weekday-name]").textContent.trim(), "Wednesday");
    assert.deepEqual(
      [...rows[3].querySelectorAll("[part~=lc-calendar-week-event-title]")].map((node) => node.textContent.trim()),
      ["Launch"],
    );
    assert.equal(rows[3].querySelector("[part~=lc-calendar-week-event-time]").textContent.trim(), "14:00");
    assert.equal(rows[1].querySelectorAll("[part~=lc-calendar-week-event]").length, 1);
    assert.equal(root.querySelectorAll("[part~=lc-calendar-week-event]").length, 2, "the next week's event is not drawn");
  });

  it("marks today's numeral in the text colour and the rest muted", async () => {
    const { root } = await mount({ events: [], viewMode: "week" });
    const today = root.querySelector("[part~=lc-calendar-week-day-number-today]");
    assert.ok(today, "with no selected date the week is the current one");
    assert.equal(today.textContent.trim(), String(new Date().getDate()));
    const other = [...root.querySelectorAll("[part~=lc-calendar-week-day-number]")].find((node) => node !== today);
    assert.notEqual(getComputedStyle(today).color, getComputedStyle(other).color);
  });

  it("draws events through renderEvent and emits day-click and event-click", async () => {
    const { el, root } = await mount({
      events: EVENTS,
      viewMode: "week",
      selectedDate: WEDNESDAY,
      renderEvent: (event) => html`<b class="custom">${event.title}</b>`,
    });
    const seen = [];
    el.addEventListener("day-click", (e) => seen.push(["day", e.detail.date, e.detail.events.length]));
    el.addEventListener("event-click", (e) => seen.push(["event", e.detail.event.id]));
    const rows = root.querySelectorAll("[part~=lc-calendar-week-day]");
    assert.equal(rows[3].querySelector(".custom").textContent, "Launch");
    assert.equal(rows[3].querySelector("[part~=lc-calendar-week-event-card]"), null);
    rows[3].querySelector(".custom").click();
    rows[1].click();
    assert.deepEqual(seen, [["event", "b"], ["day", "2026-09-21", 1]]);
  });

  it("takes a drop on each day row", async () => {
    const drops = [];
    const { root } = await mount({
      events: EVENTS,
      viewMode: "week",
      selectedDate: WEDNESDAY,
      onDayDrop: (date, id) => drops.push([date, id]),
    });
    const rows = root.querySelectorAll("[part~=lc-calendar-week-day]");
    for (const index of [0, 5]) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", `card-${index}`);
      rows[index].dispatchEvent(new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }));
    }
    assert.deepEqual(drops, [["2026-09-20", "card-0"], ["2026-09-25", "card-5"]]);
  });

  it("moves a week at a time and offers week in the toggle", async () => {
    const { el, root } = await mount({ events: EVENTS, viewMode: "week", selectedDate: WEDNESDAY });
    const labels = [...root.querySelectorAll("[part~=lc-calendar-toggle-btn]")].map((node) => node.textContent.trim());
    assert.deepEqual(labels, ["List", "Week", "Month"]);
    root.querySelector("[part~=lc-calendar-nav-btn-next]").click();
    await el.$requestUpdate();
    assert.equal(el.selectedDate, "2026-09-30");
    assert.equal(root.querySelector("[part~=lc-calendar-week-day]").dataset.date, "2026-09-27");
    assert.equal(root.querySelectorAll("[part~=lc-calendar-week-event]").length, 1);
  });
});
