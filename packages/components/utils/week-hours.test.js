import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandWeek, groupWeek, isClock, pastMidnight, weekOrder } from "./week-hours.js";

const BIP = [
  { days: [2, 3, 4], open: "18:00", close: "01:00" },
  { days: [5, 6], open: "18:00", close: "02:00" },
  { days: [0], open: "17:00", close: "00:00" },
];

describe("a week of opening hours", () => {
  it("reads a time of day, and nothing else", () => {
    assert.equal(isClock("18:00"), true);
    assert.equal(isClock("00:00"), true);
    for (const v of ["24:00", "8:00", "18:60", "", null, 1800]) assert.equal(isClock(v), false, String(v));
  });

  it("lists the week from the day a reader starts on", () => {
    assert.deepEqual(weekOrder(1), [1, 2, 3, 4, 5, 6, 0]);
    assert.deepEqual(weekOrder(0), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(weekOrder(), weekOrder(1));
  });

  it("expands entries into the seven days, a day in none being closed", () => {
    const week = expandWeek(BIP);
    assert.equal(week[1], null, "Monday is closed");
    assert.deepEqual(week[3], { open: "18:00", close: "01:00" });
    assert.deepEqual(week[0], { open: "17:00", close: "00:00" });
  });

  it("leaves out what is not an entry", () => {
    assert.deepEqual(expandWeek(null), Array(7).fill(null));
    const week = expandWeek([{ days: [1, 9, 2.5], open: "09:00", close: "18:00" }, { days: [2], open: "9am", close: "18:00" }, "x"]);
    assert.deepEqual(week.map(Boolean), [false, true, false, false, false, false, false]);
  });

  it("groups the days that keep the same hours, Monday first, and reads back what it wrote", () => {
    const week = expandWeek(BIP);
    const grouped = groupWeek(week);
    assert.deepEqual(grouped, BIP);
    assert.deepEqual(expandWeek(grouped), week);
    week[1] = { open: "18:00", close: "01:00" };
    assert.deepEqual(groupWeek(week)[0], { days: [1, 2, 3, 4], open: "18:00", close: "01:00" });
    assert.deepEqual(groupWeek(Array(7).fill(null)), []);
  });

  it("knows hours that run past midnight", () => {
    assert.equal(pastMidnight({ open: "18:00", close: "02:00" }), true);
    assert.equal(pastMidnight({ open: "17:00", close: "00:00" }), true);
    assert.equal(pastMidnight({ open: "09:00", close: "18:00" }), false);
  });
});
