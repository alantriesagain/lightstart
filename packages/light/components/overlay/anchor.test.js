import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANCHOR_GUTTER_PX, anchorPosition, parseAnchor } from "./anchor.js";

/**
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 */
const rect = (left, top, width, height) => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

const viewport = { width: 1000, height: 800 };
const trigger = rect(400, 300, 100, 40);
const floating = { width: 200, height: 120 };

describe("@bootstrapp/light - parseAnchor", () => {
  it("reads a side and a modifier", () => {
    assert.deepEqual(parseAnchor("bottom-left"), { side: "bottom", align: "start" });
    assert.deepEqual(parseAnchor("top-right"), { side: "top", align: "end" });
  });

  it("gives a bare top or bottom the default it was handed", () => {
    assert.deepEqual(parseAnchor("bottom", "start"), { side: "bottom", align: "start" });
    assert.deepEqual(parseAnchor("bottom", "center"), { side: "bottom", align: "center" });
  });

  it("centres a bare left or right, whatever the default says", () => {
    assert.deepEqual(parseAnchor("left", "start"), { side: "left", align: "center" });
    assert.deepEqual(parseAnchor("right", "start"), { side: "right", align: "center" });
  });

  it("falls back to bottom for a side it does not know", () => {
    assert.equal(parseAnchor("sideways").side, "bottom");
    assert.equal(parseAnchor("").side, "bottom");
  });
});

describe("@bootstrapp/light - anchorPosition", () => {
  it("puts a bottom-start box under the trigger's left edge", () => {
    const at = anchorPosition({ trigger, floating, side: "bottom", align: "start", offset: 4, viewport });
    assert.deepEqual(at, { top: 344, left: 400 });
  });

  it("puts a bottom-end box under the trigger's right edge", () => {
    const at = anchorPosition({ trigger, floating, side: "bottom", align: "end", offset: 4, viewport });
    assert.deepEqual(at, { top: 344, left: 300 }, "the box's right edge meets the trigger's");
  });

  it("lifts a top box by its own height, not the trigger's", () => {
    const at = anchorPosition({ trigger, floating, side: "top", align: "start", offset: 4, viewport });
    assert.equal(at.top, 300 - 120 - 4);
  });

  it("centres a side box on the trigger, using both heights", () => {
    const at = anchorPosition({ trigger, floating, side: "right", align: "center", offset: 4, viewport });
    assert.equal(at.left, 504);
    assert.equal(at.top, 300 + 20 - 60, "the trigger's middle, less half the box");
  });

  it("keeps a box that would overflow the right edge inside the gutter", () => {
    const at = anchorPosition({ trigger: rect(950, 300, 40, 40), floating, side: "bottom", align: "start", viewport });
    assert.equal(at.left, 1000 - 200 - ANCHOR_GUTTER_PX);
  });

  it("keeps a box that would overflow the bottom inside the gutter", () => {
    const at = anchorPosition({ trigger: rect(400, 780, 40, 40), floating, side: "bottom", align: "start", viewport });
    assert.equal(at.top, 800 - 120 - ANCHOR_GUTTER_PX);
  });

  it("never places a box before the gutter", () => {
    const at = anchorPosition({ trigger: rect(2, 2, 10, 10), floating, side: "top", align: "start", viewport });
    assert.equal(at.top, ANCHOR_GUTTER_PX);
    assert.equal(at.left, ANCHOR_GUTTER_PX);
  });

  it("puts a box larger than the viewport at the gutter rather than off the near edge", () => {
    const at = anchorPosition({
      trigger,
      floating: { width: 2000, height: 2000 },
      side: "bottom",
      align: "start",
      viewport,
    });
    assert.deepEqual(at, { top: ANCHOR_GUTTER_PX, left: ANCHOR_GUTTER_PX });
  });

  it("treats offset as the gap between the trigger and the box", () => {
    const near = anchorPosition({ trigger, floating, side: "bottom", align: "start", offset: 0, viewport });
    const far = anchorPosition({ trigger, floating, side: "bottom", align: "start", offset: 12, viewport });
    assert.equal(far.top - near.top, 12);
  });
});
