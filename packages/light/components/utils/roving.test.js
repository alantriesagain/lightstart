import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextIndex } from "./roving.js";

describe("@bootstrapp/light - nextIndex", () => {
  it("steps forward and back along the vertical axis by default", () => {
    assert.equal(nextIndex("ArrowDown", 1, 5), 2);
    assert.equal(nextIndex("ArrowUp", 1, 5), 0);
  });

  it("ignores the axis it was not given", () => {
    assert.equal(nextIndex("ArrowRight", 1, 5), null);
    assert.equal(nextIndex("ArrowDown", 1, 5, { orientation: "horizontal" }), null);
    assert.equal(nextIndex("ArrowRight", 1, 5, { orientation: "horizontal" }), 2);
  });

  it("takes all four arrows when the orientation is both", () => {
    for (const key of ["ArrowDown", "ArrowRight"]) assert.equal(nextIndex(key, 1, 5, { orientation: "both" }), 2);
    for (const key of ["ArrowUp", "ArrowLeft"]) assert.equal(nextIndex(key, 1, 5, { orientation: "both" }), 0);
  });

  it("says nothing about a key it does not handle", () => {
    assert.equal(nextIndex("Enter", 1, 5), null);
    assert.equal(nextIndex("a", 1, 5), null);
    assert.equal(nextIndex("Home", 3, 5), null, "Home is off unless asked for");
  });

  it("stops at both ends when it does not wrap", () => {
    assert.equal(nextIndex("ArrowDown", 4, 5), null, "already last");
    assert.equal(nextIndex("ArrowUp", 0, 5), null, "already first");
  });

  it("continues past both ends when it wraps", () => {
    assert.equal(nextIndex("ArrowDown", 4, 5, { wrap: true }), 0);
    assert.equal(nextIndex("ArrowUp", 0, 5, { wrap: true }), 4);
  });

  it("answers Home and End only when asked", () => {
    assert.equal(nextIndex("Home", 3, 5, { homeEnd: true }), 0);
    assert.equal(nextIndex("End", 3, 5, { homeEnd: true }), 4);
    assert.equal(nextIndex("Home", 0, 5, { homeEnd: true }), null, "already there");
    assert.equal(nextIndex("End", 4, 5, { homeEnd: true }), null);
  });

  it("enters a wrapping list from whichever end the key points at", () => {
    assert.equal(nextIndex("ArrowDown", -1, 5, { wrap: true }), 0);
    assert.equal(nextIndex("ArrowUp", -1, 5, { wrap: true }), 4);
  });

  it("enters a clamping list at the first item either way", () => {
    assert.equal(nextIndex("ArrowDown", -1, 5), 0);
    assert.equal(nextIndex("ArrowUp", -1, 5), 0, "there is nothing above the first");
  });

  it("has nowhere to go in an empty list", () => {
    assert.equal(nextIndex("ArrowDown", -1, 0, { wrap: true }), null);
    assert.equal(nextIndex("Home", -1, 0, { homeEnd: true }), null);
  });

  it("moves nowhere in a list of one", () => {
    assert.equal(nextIndex("ArrowDown", 0, 1, { wrap: true }), null);
    assert.equal(nextIndex("ArrowUp", 0, 1, { wrap: true }), null);
  });
});
