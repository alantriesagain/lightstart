import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampRect, loadRect, saveRect } from "./float-rect.js";

const memStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
};

describe("lc-float-panel rect math", () => {
  const viewport = { width: 1280, height: 720 };
  const mins = { minWidth: 280, minHeight: 320 };

  it("passes an in-bounds rect through unchanged", () => {
    const rect = { x: 100, y: 100, w: 380, h: 500 };
    assert.deepEqual(clampRect(rect, viewport, mins), rect);
  });

  it("keeps at least 48px of the handle visible on every edge", () => {
    assert.deepEqual(clampRect({ x: -5000, y: -5000, w: 380, h: 500 }, viewport, mins), { x: -332, y: 0, w: 380, h: 500 });
    assert.deepEqual(clampRect({ x: 5000, y: 5000, w: 380, h: 500 }, viewport, mins), { x: 1232, y: 672, w: 380, h: 500 });
  });

  it("enforces min sizes and caps at the viewport", () => {
    assert.deepEqual(clampRect({ x: 0, y: 0, w: 10, h: 10 }, viewport, mins), { x: 0, y: 0, w: 280, h: 320 });
    assert.equal(clampRect({ x: 0, y: 0, w: 9999, h: 500 }, viewport, mins).w, 1280);
    assert.equal(clampRect({ x: 0, y: 0, w: 380, h: 9999 }, viewport, mins).h, 720);
  });

  it("keeps min sizes when the viewport is smaller than them", () => {
    const tiny = clampRect({ x: 0, y: 0, w: 380, h: 500 }, { width: 200, height: 200 }, mins);
    assert.equal(tiny.w, 280);
    assert.equal(tiny.h, 320);
    assert.deepEqual([tiny.x, tiny.y], [0, 0]);
  });

  it("falls back on missing, corrupt, or partial persisted rects", () => {
    const fallback = { x: 1, y: 2, w: 380, h: 500 };
    const storage = memStorage();
    assert.deepEqual(loadRect(storage, "k", fallback), fallback);
    storage.setItem("k", "{not json");
    assert.deepEqual(loadRect(storage, "k", fallback), fallback);
    storage.setItem("k", JSON.stringify({ x: 1, y: 2 }));
    assert.deepEqual(loadRect(storage, "k", fallback), fallback);
    storage.setItem("k", JSON.stringify({ x: "1", y: 2, w: 3, h: 4 }));
    assert.deepEqual(loadRect(storage, "k", fallback), fallback);
    assert.notEqual(loadRect(storage, "k", fallback), fallback);
  });

  it("round-trips a rect through save and load", () => {
    const storage = memStorage();
    const rect = { x: 12, y: 34, w: 380, h: 500 };
    saveRect(storage, "k", rect);
    assert.deepEqual(loadRect(storage, "k", { x: 0, y: 0, w: 0, h: 0 }), rect);
  });

  it("saves only the rect keys and survives setItem failures", () => {
    const storage = memStorage();
    saveRect(storage, "k", { x: 1, y: 2, w: 3, h: 4, extra: true });
    assert.equal(storage.getItem("k"), JSON.stringify({ x: 1, y: 2, w: 3, h: 4 }));
    assert.doesNotThrow(() => saveRect({ setItem: () => { throw new Error("full"); } }, "k", { x: 0, y: 0, w: 0, h: 0 }));
  });
});
