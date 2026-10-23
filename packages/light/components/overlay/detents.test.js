import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, releaseVelocity, resolveStops, rubber } from "./detents.js";

describe("@bootstrapp/light - detent math", () => {
  const stops = resolveStops({ height: 800, halfPx: 350, peekPx: 60 });

  it("resolves stops as translate offsets from fully open", () => {
    assert.deepEqual(stops, { full: 0, half: 450, closed: 740 });
  });

  it("clamps stops at zero when the var exceeds the height", () => {
    assert.equal(resolveStops({ height: 300, halfPx: 400, peekPx: 60 }).half, 0);
  });

  it("classifies by nearest stop, closed only inside the dismiss zone", () => {
    assert.equal(classify(stops, 0), "full");
    assert.equal(classify(stops, 200), "full");
    assert.equal(classify(stops, 300), "half");
    assert.equal(classify(stops, 600), "half");
    assert.equal(classify(stops, 730), "closed");
    assert.equal(classify(stops, 700), "half");
  });

  it("averages release velocity over the last 100ms only", () => {
    const now = 1000;
    const samples = [
      { t: 700, y: 0 },
      { t: 920, y: 100 },
      { t: 960, y: 140 },
      { t: 1000, y: 180 },
    ];
    assert.equal(releaseVelocity(samples, now), (180 - 100) / (1000 - 920));
  });

  it("returns zero velocity for taps and stale samples", () => {
    assert.equal(releaseVelocity([], 1000), 0);
    assert.equal(releaseVelocity([{ t: 500, y: 0 }, { t: 510, y: 50 }], 1000), 0);
    assert.equal(releaseVelocity([{ t: 990, y: 0 }, { t: 1000, y: 50 }], 1000), 0);
  });

  it("rubber-bands asymptotically toward its cap", () => {
    assert.equal(rubber(0), 0);
    assert.equal(rubber(64) < 64, true);
    assert.equal(rubber(10000) < 64, true);
    assert.equal(rubber(64) > rubber(32), true);
  });
});
