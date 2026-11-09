import assert from "node:assert/strict";
import { test } from "node:test";
import { dayKeyOf, dayWords, groupByDay, readAt, timeWords } from "./day-groups.js";

/** @import { TimelineDay, TimelineEntry } from "../types.ts" */

const shape = (/** @type {TimelineDay[]} */ days) => days.map(({ day, entries }) => [day, entries.map((entry) => entry.title)]);

const ACROSS_MIDNIGHT = [
  { at: "2026-10-27T01:30:00Z", title: "night" },
  { at: "2026-10-27T23:30:00Z", title: "evening" },
  { at: "2026-10-27", title: "all day" },
];

test("a day is the reader's date, so the same instants fall on other days in another zone", () => {
  assert.deepEqual(shape(groupByDay(ACROSS_MIDNIGHT, { timeZone: "America/Sao_Paulo" })), [
    ["2026-10-27", ["evening", "all day"]],
    ["2026-10-26", ["night"]],
  ]);
  assert.deepEqual(shape(groupByDay(ACROSS_MIDNIGHT, { timeZone: "Asia/Tokyo" })), [
    ["2026-10-28", ["evening"]],
    ["2026-10-27", ["night", "all day"]],
  ]);
});

test("a date alone stays its own day in any zone and sorts as the start of it", () => {
  assert.deepEqual(readAt("2026-10-27"), { kind: "date", day: "2026-10-27" });
  const entries = [
    { at: "2026-10-27", title: "all day" },
    { at: "2026-10-27T00:10:00-10:00", title: "early" },
  ];
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "Pacific/Honolulu" })), [["2026-10-27", ["early", "all day"]]]);
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "Pacific/Honolulu", oldestFirst: true })), [
    ["2026-10-27", ["all day", "early"]],
  ]);
});

test("a 25-hour day is still one day", () => {
  const first = Date.parse("2026-10-25T00:30:00+01:00");
  const last = Date.parse("2026-10-25T23:30:00+00:00");
  assert.equal(dayKeyOf(first, "Europe/London"), "2026-10-25");
  assert.equal(dayKeyOf(last, "Europe/London"), "2026-10-25");
});

test("entries at the same moment keep the order they were given in", () => {
  const entries = [
    { at: "2026-10-27T09:00:00Z", title: "first" },
    { at: "2026-10-27T09:00:00Z", title: "second" },
  ];
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "UTC" })), [["2026-10-27", ["first", "second"]]]);
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "UTC", oldestFirst: true })), [["2026-10-27", ["first", "second"]]]);
});

test("an unreadable moment is kept, last and under no day, whichever way the days run", () => {
  /** @type {TimelineEntry[]} */
  const entries = [
    { at: "not a date", title: "lost" },
    { at: "2026-10-26T09:00:00Z", title: "yesterday" },
    { at: "", title: "empty" },
    { at: "2026-10-27T09:00:00Z", title: "today" },
  ];
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "UTC" })), [
    ["2026-10-27", ["today"]],
    ["2026-10-26", ["yesterday"]],
    [null, ["lost", "empty"]],
  ]);
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "UTC", oldestFirst: true })), [
    ["2026-10-26", ["yesterday"]],
    ["2026-10-27", ["today"]],
    [null, ["lost", "empty"]],
  ]);
  assert.deepEqual(readAt(/** @type {string} */ (/** @type {unknown} */ (undefined))), { kind: "unreadable" });
});

test("oldest first reverses the days and the entries within each", () => {
  const entries = [
    { at: "2026-10-27T09:00:00Z", title: "09:00" },
    { at: "2026-10-27T15:00:00Z", title: "15:00" },
    { at: "2026-10-26T12:00:00Z", title: "yesterday" },
    { at: "2026-10-27T11:00:00Z", title: "11:00" },
  ];
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "UTC" })), [
    ["2026-10-27", ["15:00", "11:00", "09:00"]],
    ["2026-10-26", ["yesterday"]],
  ]);
  assert.deepEqual(shape(groupByDay(entries, { timeZone: "UTC", oldestFirst: true })), [
    ["2026-10-26", ["yesterday"]],
    ["2026-10-27", ["09:00", "11:00", "15:00"]],
  ]);
});

test("no entries are no days", () => {
  assert.deepEqual(groupByDay([]), []);
});

test("the day's words come from the reader's language, capitalised as a heading", () => {
  const around = (/** @type {string} */ locale) =>
    ["2026-10-27", "2026-10-26", "2026-10-28"].map((day) => dayWords(day, locale, "2026-10-27"));
  assert.deepEqual(around("en"), ["Today", "Yesterday", "Tomorrow"]);
  assert.deepEqual(around("es"), ["Hoy", "Ayer", "Mañana"]);
  assert.deepEqual(around("pt"), ["Hoje", "Ontem", "Amanhã"]);
});

test("any other day is its weekday and date, with the year only when it is not this one", () => {
  assert.equal(dayWords("2026-03-03", "en", "2026-10-27"), "Tuesday, March 3");
  assert.equal(dayWords("2025-03-03", "en", "2026-10-27"), "Monday, March 3, 2025");
});

test("an instant's time is the reader's short clock, and a malformed locale reads as English", () => {
  const ms = Date.parse("2026-10-27T15:05:00Z");
  const english = new Date(ms).toLocaleTimeString("en", { timeStyle: "short" });
  assert.equal(timeWords(ms, "en"), english);
  assert.equal(timeWords(ms, "en_US"), english);
});
