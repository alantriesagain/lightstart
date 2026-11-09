import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  boundsOf, clampRect, coverRect, fitWithin, halvingSteps, keyIntent, panRect, pinchRect, pinchStep,
  qualitySteps, rectAtZoom, sourceRect, wheelFactor, zoomOf, zoomRectAt,
} from "./crop-rect.js";

const LANDSCAPE = boundsOf(1200, 800, 4);
const VIEW = 400;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ""} ${a} is not ${b}`);

describe("the crop's square", () => {
  it("opens on the largest square in the middle of the picture", () => {
    assert.deepEqual(coverRect(LANDSCAPE), { x: 200, y: 0, size: 800 });
    assert.deepEqual(coverRect(boundsOf(600, 900)), { x: 0, y: 150, size: 600 });
  });

  it("never leaves the picture, never uncovers the frame, never zooms past the limit", () => {
    assert.deepEqual(clampRect({ x: -50, y: 900, size: 300 }, LANDSCAPE), { x: 0, y: 500, size: 300 });
    assert.equal(clampRect({ x: 0, y: 0, size: 5000 }, LANDSCAPE).size, 800);
    assert.equal(clampRect({ x: 0, y: 0, size: 10 }, LANDSCAPE).size, 200, "a quarter of the shorter side at four times");
  });

  it("moves with the finger: dragging right shows more of the left", () => {
    const start = { x: 200, y: 0, size: 800 };
    assert.deepEqual(panRect(start, 100, 0, VIEW, LANDSCAPE), { x: 0, y: 0, size: 800 }, "100 screen pixels are 200 picture pixels here");
    assert.deepEqual(panRect(start, -1000, 0, VIEW, LANDSCAPE), { x: 400, y: 0, size: 800 }, "and it stops at the edge");
  });

  it("keeps what is under the point it zooms about where it was", () => {
    const start = { x: 200, y: 0, size: 800 };
    const zoomed = zoomRectAt(start, 2, 100, 100, VIEW, LANDSCAPE);
    near(zoomed.size, 400);
    near(start.x + (100 / VIEW) * start.size, zoomed.x + (100 / VIEW) * zoomed.size, "x under the point");
    near(start.y + (100 / VIEW) * start.size, zoomed.y + (100 / VIEW) * zoomed.size, "y under the point");
  });

  it("reads and sets the zoom a slider shows, about the middle", () => {
    const start = coverRect(LANDSCAPE);
    assert.equal(zoomOf(start, LANDSCAPE), 1);
    const twice = rectAtZoom(start, 2, LANDSCAPE);
    assert.deepEqual(twice, { x: 400, y: 200, size: 400 });
    assert.equal(zoomOf(rectAtZoom(start, 99, LANDSCAPE), LANDSCAPE), 4, "the slider cannot go past the limit either");
    assert.equal(zoomOf(rectAtZoom(twice, 0.1, LANDSCAPE), LANDSCAPE), 1);
  });
});

describe("gestures", () => {
  it("reads a pinch as a spread about the fingers' middle and the middle's move", () => {
    const step = pinchStep([{ x: 100, y: 200 }, { x: 200, y: 200 }], [{ x: 90, y: 220 }, { x: 290, y: 220 }]);
    near(step.factor, 2);
    assert.deepEqual([step.x, step.y, step.dx, step.dy], [190, 220, 40, 20]);
  });

  it("zooms in as the fingers spread, and a pinch that does not move changes nothing", () => {
    const start = coverRect(LANDSCAPE);
    const out = pinchRect(start, [{ x: 150, y: 200 }, { x: 250, y: 200 }], [{ x: 100, y: 200 }, { x: 300, y: 200 }], VIEW, LANDSCAPE);
    near(out.size, 400);
    assert.deepEqual(pinchRect(start, [{ x: 1, y: 1 }, { x: 2, y: 2 }], [{ x: 1, y: 1 }, { x: 2, y: 2 }], VIEW, LANDSCAPE), start);
  });

  it("turns a wheel into a smooth factor, in for up and out for down, never more than half again", () => {
    assert.ok(wheelFactor(-100) > 1);
    assert.ok(wheelFactor(100) < 1);
    assert.equal(wheelFactor(-10000), 1.5);
    near(wheelFactor(3, 1), wheelFactor(48, 0), "three lines are 48 pixels");
  });

  it("reads the keys a crop answers", () => {
    assert.deepEqual(keyIntent("ArrowLeft"), { pan: [-16, 0] });
    assert.deepEqual(keyIntent("ArrowDown", { shift: true }), { pan: [0, 64] });
    assert.deepEqual(keyIntent("+"), { zoom: 1.2 });
    near(/** @type {{ zoom: number }} */ (keyIntent("-")).zoom, 1 / 1.2);
    assert.deepEqual(keyIntent("0"), { reset: true });
    assert.equal(keyIntent("a"), null);
  });
});

describe("drawing and encoding", () => {
  it("draws a square in whole pixels inside the picture", () => {
    assert.deepEqual(sourceRect({ x: 399.6, y: -0.2, size: 800.4 }, LANDSCAPE), { sx: 400, sy: 0, size: 800 });
    assert.deepEqual(sourceRect({ x: 1000, y: 0, size: 800 }, LANDSCAPE), { sx: 400, sy: 0, size: 800 });
  });

  it("scales a picture down to what a canvas can take, and never up", () => {
    const big = fitWithin(8000, 6000, 8_388_608);
    assert.ok(big.width * big.height <= 8_388_608);
    near(big.width / big.height, 8000 / 6000, "the shape");
    assert.deepEqual(fitWithin(640, 480, 8_388_608), { width: 640, height: 480, scale: 1 });
  });

  it("steps the quality down, and a shrink down by halves", () => {
    assert.deepEqual(qualitySteps(0.9, 0.5, 0.1), [0.9, 0.8, 0.7, 0.6, 0.5]);
    assert.deepEqual(halvingSteps(3000, 512), [1500, 750, 512]);
    assert.deepEqual(halvingSteps(800, 512), [512]);
  });
});
