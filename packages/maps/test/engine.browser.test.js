import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createMapEngine } from "../engine.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const TILES = `${PNG}#{z}/{x}/{y}`;

const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

/**
 * @template T
 * @param {() => T | null | undefined} get
 * @param {string} what
 * @returns {Promise<T>}
 */
const until = async (get, what) => {
  for (let i = 0; i < 240; i++) {
    const found = get();
    if (found) return found;
    await frame();
  }
  throw new Error(`timed out waiting for ${what}`);
};

const close = (/** @type {number} */ a, /** @type {number} */ b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {number} x
 * @param {number} y
 * @param {PointerEventInit} [init]
 */
const pointer = (target, type, x, y, init = {}) => {
  const e = new PointerEvent(type, { pointerId: 1, button: 0, pointerType: "mouse", clientX: x, clientY: y, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

/**
 * @param {HTMLElement} container
 * @param {WheelEventInit} init
 */
const wheel = (container, init) => {
  const r = container.getBoundingClientRect();
  const e = new WheelEvent("wheel", { clientX: r.left + 200, clientY: r.top + 150, bubbles: true, cancelable: true, ...init });
  container.dispatchEvent(e);
  return e;
};

describe("map engine", () => {
  /** @type {Array<() => void>} */
  const cleanups = [];

  /** @param {import("../types.ts").MapEngineOptions} [opts] */
  const mount = (opts = {}) => {
    const container = document.createElement("div");
    container.style.cssText = "width:400px;height:300px";
    document.body.appendChild(container);
    const engine = createMapEngine(container, { tileUrl: TILES, center: [0, 0], zoom: 3, ...opts });
    cleanups.push(() => {
      engine.destroy();
      container.remove();
    });
    return { container, engine };
  };

  /** @param {HTMLElement} container */
  const imgs = (container) => [...container.querySelectorAll("img")];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it("draws the tiles the viewport shows once idle, from the template", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    const tiles = imgs(container);
    assert.equal(tiles.length, 4);
    assert.ok(tiles.every((img) => img.dataset.ok === "1"));
    assert.deepEqual(tiles.map((img) => img.src.slice(PNG.length)).sort(), ["#3/3/3", "#3/3/4", "#3/4/3", "#3/4/4"]);
    assert.equal(container.querySelectorAll(":scope > div > div").length, 1);
  });

  it("drops the old level once the next one has settled", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    engine.setView([0, 0], 4);
    await until(() => imgs(container).some((img) => img.src.includes("#4/")), "the next level");
    await engine.whenIdle();
    assert.equal(container.querySelectorAll(":scope > div > div").length, 1);
    assert.ok(imgs(container).every((img) => img.src.includes("#4/")));
  });

  it("goes idle after tiles fail, hiding them", async () => {
    const { container, engine } = mount({ tileUrl: "data:,#{z}/{x}/{y}" });
    await engine.whenIdle();
    const tiles = imgs(container);
    assert.equal(tiles.length, 4);
    assert.ok(tiles.every((img) => img.dataset.ok === "1" && img.style.display === "none"));
  });

  it("answers at once when nothing moves or loads", async () => {
    const { engine } = mount();
    await engine.whenIdle();
    let resolved = false;
    engine.whenIdle().then(() => (resolved = true));
    await Promise.resolve();
    assert.equal(resolved, true);
  });

  it("schedules a render once per burst, already pending when it says so", async () => {
    let calls = 0;
    /** @type {Promise<void> | null} */
    let idle = null;
    /** @type {ReturnType<typeof createMapEngine> | null} */
    let watched = null;
    const { engine } = mount({
      onRenderScheduled: () => {
        calls++;
        if (watched && !idle) idle = watched.whenIdle();
      },
    });
    await engine.whenIdle();
    calls = 0;
    watched = engine;
    engine.setView([1, 1], 3);
    engine.setView([2, 2], 3);
    engine.resize();
    assert.equal(calls, 1);
    let landed = false;
    const waiting = /** @type {Promise<void>} */ (/** @type {unknown} */ (idle));
    waiting.then(() => (landed = true));
    await Promise.resolve();
    assert.equal(landed, false);
    await waiting;
    assert.equal(landed, true);
  });

  it("flies to a point and lands on it", async () => {
    const { engine } = mount();
    await engine.whenIdle();
    engine.flyTo([-22.9, -43.2], 10, 120);
    assert.equal(engine.isInteracting(), true);
    await engine.whenIdle();
    const [lat, lng] = engine.getCenter();
    close(lat, -22.9);
    close(lng, -43.2);
    assert.equal(engine.getZoom(), 10);
    assert.equal(engine.isInteracting(), false);
  });

  it("fits a bbox the same way animated or not", async () => {
    const bbox = { west: -43.3, south: -23.0, east: -43.1, north: -22.8 };
    const { engine } = mount();
    await engine.whenIdle();
    engine.fitBounds(bbox, { padding: 24 });
    const still = [...engine.getCenter(), engine.getZoom()];
    engine.setView([0, 0], 3);
    await engine.whenIdle();
    engine.fitBounds(bbox, { padding: 24, animate: true });
    assert.equal(engine.getZoom(), 3);
    await engine.whenIdle();
    const flown = [...engine.getCenter(), engine.getZoom()];
    close(flown[0], still[0]);
    close(flown[1], still[1]);
    assert.equal(flown[2], still[2]);
    assert.equal(still[2], 10);
  });

  it("redraws from a new tile template and ignores the same one", async () => {
    let calls = 0;
    const { container, engine } = mount({ onRenderScheduled: () => calls++ });
    await engine.whenIdle();
    const before = imgs(container);
    calls = 0;
    engine.setTileUrl(TILES);
    engine.setTileUrl("");
    assert.equal(calls, 0);
    assert.ok(before.every((img) => img.isConnected));
    engine.setTileUrl(`${PNG}#b/{z}/{x}/{y}`);
    assert.equal(calls, 1);
    await engine.whenIdle();
    const after = imgs(container);
    assert.equal(after.length, 4);
    assert.ok(before.every((img) => !img.isConnected));
    assert.ok(after.every((img) => img.src.includes("#b/3/")));
  });

  it("zooms a level per wheel step about the cursor, a ctrl-wheel four times faster", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    const plain = wheel(container, { deltaY: -400 });
    assert.equal(plain.defaultPrevented, true);
    await engine.whenIdle();
    assert.equal(engine.getZoom(), 4);
    assert.ok(imgs(container).every((img) => img.src.includes("#4/")));
    const pinch = wheel(container, { deltaY: -100, ctrlKey: true });
    assert.equal(pinch.defaultPrevented, true);
    await engine.whenIdle();
    assert.equal(engine.getZoom(), 5);
    const [lat, lng] = engine.getCenter();
    close(lat, 0);
    close(lng, 0);
  });

  it("drags the map under the pointer and reports the drag", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    const [x0, y0] = engine.project(0, 0);
    pointer(container, "pointerdown", 100, 100);
    assert.equal(engine.isInteracting(), true);
    pointer(container, "pointermove", 120, 110);
    pointer(container, "pointermove", 140, 90);
    pointer(container, "pointerup", 140, 90);
    const [x1, y1] = engine.project(0, 0);
    close(x1 - x0, 40);
    close(y1 - y0, -10);
    assert.ok(engine.getCenter()[1] < 0);
    assert.equal(engine.wasDragged(), true);
    assert.equal(engine.isInteracting(), false);
  });

  it("treats a drag of 3 px as a tap", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    pointer(container, "pointerdown", 100, 100);
    pointer(container, "pointermove", 100, 103);
    pointer(container, "pointerup", 100, 103);
    assert.equal(engine.wasDragged(), false);
  });

  it("zooms in a level on two touch taps", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    const r = container.getBoundingClientRect();
    const [x, y] = [r.left + 200, r.top + 150];
    for (let i = 0; i < 2; i++) {
      pointer(container, "pointerdown", x, y, { pointerType: "touch" });
      pointer(container, "pointerup", x, y, { pointerType: "touch" });
    }
    await engine.whenIdle();
    assert.equal(engine.getZoom(), 4);
    assert.equal(engine.wasDragged(), false);
  });

  it("zooms in a level on a double click", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    const r = container.getBoundingClientRect();
    const click = new MouseEvent("dblclick", { clientX: r.left + 200, clientY: r.top + 150, bubbles: true, cancelable: true });
    container.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true);
    await engine.whenIdle();
    assert.equal(engine.getZoom(), 4);
  });

  it("keeps a flung map moving after release, then settles", async () => {
    const { container, engine } = mount();
    await engine.whenIdle();
    pointer(container, "pointerdown", 100, 100);
    for (let i = 1; i <= 5; i++) {
      await frame();
      pointer(container, "pointermove", 100 + i * 20, 100);
    }
    pointer(container, "pointerup", 200, 100);
    const released = engine.getCenter()[1];
    assert.equal(engine.isInteracting(), true);
    await until(() => engine.getCenter()[1] < released, "the fling");
    await engine.whenIdle();
    assert.equal(engine.isInteracting(), false);
    assert.ok(engine.getCenter()[1] < released);
  });

  it("empties its container, resolves its waiters and ignores input once destroyed", async () => {
    const { container, engine } = mount();
    engine.setView([5, 5], 4);
    const waiting = engine.whenIdle();
    engine.destroy();
    await waiting;
    assert.equal(container.children.length, 0);
    await engine.whenIdle();
    const zoom = engine.getZoom();
    const center = engine.getCenter();
    assert.equal(wheel(container, { deltaY: -400 }).defaultPrevented, false);
    pointer(container, "pointerdown", 100, 100);
    pointer(container, "pointermove", 160, 100);
    pointer(container, "pointerup", 160, 100);
    await frame();
    await frame();
    assert.equal(engine.getZoom(), zoom);
    assert.deepEqual(engine.getCenter(), center);
    assert.equal(engine.wasDragged(), false);
  });
});
