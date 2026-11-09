import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactNumber, niceMax } from "./scale.js";

describe("compactNumber", () => {
  it("shortens thousands, millions and billions to one decimal", () => {
    assert.equal(compactNumber(1200), "1.2K");
    assert.equal(compactNumber(1000), "1K");
    assert.equal(compactNumber(3_000_000), "3M");
    assert.equal(compactNumber(2_450_000_000), "2.5B");
    assert.equal(compactNumber(250_000), "250K");
  });

  it("leaves small numbers as they are, with at most one decimal", () => {
    assert.equal(compactNumber(0), "0");
    assert.equal(compactNumber(42.25), "42.3");
    assert.equal(compactNumber(999), "999");
    assert.equal(compactNumber(-1500), "-1.5K");
  });
});

describe("niceMax", () => {
  it("rounds the top of the scale up to a value four round steps reach", () => {
    assert.equal(niceMax(31), 40);
    assert.equal(niceMax(100), 100);
    assert.equal(niceMax(9), 10);
    assert.equal(niceMax(1234), 2000);
    assert.equal(niceMax(0.7), 0.8);
  });

  it("answers a usable scale for an empty or zero series", () => {
    assert.equal(niceMax(0), 4);
    assert.equal(niceMax(Number.NaN), 4);
  });
});
