import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import T from "@bootstrapp/light/types";
import View, { defineComponent } from "@bootstrapp/light";
import { withSwipeThreshold } from "./swipe-threshold.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

let seq = 0;

/** @param {Parameters<typeof withSwipeThreshold>[0]} options */
const defineHost = (options) => {
  const tag = `swipe-host-${++seq}`;
  View.define(tag, defineComponent({
    mixins: [withSwipeThreshold(options)],
    tag,
    props: {
      open: true,
      log: /** @type {import("../types.ts").Prop<number[]>} */ (T.object({ reactive: false, defaultValue: null })),
    },
    connected() {
      this.log = [];
    },
    /** @param {number} direction */
    onSwipe(direction) {
      this.log.push(direction);
    },
  }));
  return tag;
};

/** @type {Element[]} */
const mounted = [];

/** @param {string} tag */
const mount = async (tag) => {
  const host = /** @type {any} */ (document.createElement(tag));
  document.body.append(host);
  mounted.push(host);
  await tick();
  return host;
};

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {{ x?: number, y?: number, id?: number, pointerType?: string }} [init]
 */
const point = (target, type, { x = 0, y = 0, id = 1, pointerType = "touch" } = {}) =>
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: id, clientX: x, clientY: y, button: 0, pointerType,
    bubbles: true, composed: true, cancelable: true,
  }));

/**
 * @param {any} host
 * @param {{ from: [number, number], to: [number, number], id?: number, pointerType?: string, end?: string }} arg
 */
const swipe = (host, { from, to, id = 1, pointerType = "touch", end = "pointerup" }) => {
  point(host, "pointerdown", { x: from[0], y: from[1], id, pointerType });
  point(host, end, { x: to[0], y: to[1], id, pointerType });
};

describe("@bootstrapp/light - withSwipeThreshold", () => {
  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("reports the direction along the axis it was asked about", async () => {
    const host = await mount(defineHost({ axis: "x" }));

    swipe(host, { from: [0, 0], to: [100, 0] });
    swipe(host, { from: [200, 0], to: [80, 0] });

    assert.deepEqual(host.log, [1, -1]);
  });

  it("ignores travel short of the threshold", async () => {
    const host = await mount(defineHost({ axis: "x", threshold: 60 }));

    swipe(host, { from: [0, 0], to: [59, 0] });
    assert.deepEqual(host.log, []);

    swipe(host, { from: [0, 0], to: [61, 0] });
    assert.deepEqual(host.log, [1]);
  });

  it("ignores travel the other axis wins", async () => {
    const host = await mount(defineHost({ axis: "x" }));

    swipe(host, { from: [0, 0], to: [100, 120] });
    assert.deepEqual(host.log, [], "mostly vertical is not a horizontal swipe");

    swipe(host, { from: [0, 0], to: [100, 40] });
    assert.deepEqual(host.log, [1]);
  });

  it("holds the chosen axis to the ratio it was given", async () => {
    const host = await mount(defineHost({ axis: "y", ratio: 1.2 }));

    swipe(host, { from: [0, 0], to: [80, -90] });
    assert.deepEqual(host.log, [], "90 vertical does not beat 80 horizontal by 1.2");

    swipe(host, { from: [0, 0], to: [60, -90] });
    assert.deepEqual(host.log, [-1], "but it beats 60");
  });

  it("drops a gesture the platform cancels", async () => {
    const host = await mount(defineHost({ axis: "x" }));

    swipe(host, { from: [0, 0], to: [200, 0], end: "pointercancel" });
    assert.deepEqual(host.log, []);

    swipe(host, { from: [0, 0], to: [200, 0] });
    assert.deepEqual(host.log, [1], "and is ready for the next one");
  });

  it("reads its gate at pointerdown", async () => {
    const host = await mount(defineHost({ axis: "x", enabled: "open" }));
    host.open = false;
    await host.$requestUpdate();

    swipe(host, { from: [0, 0], to: [200, 0] });
    assert.deepEqual(host.log, []);

    host.open = true;
    await host.$requestUpdate();
    swipe(host, { from: [0, 0], to: [200, 0] });
    assert.deepEqual(host.log, [1]);
  });

  it("answers only the input kinds it was told to", async () => {
    const host = await mount(defineHost({ axis: "x", pointerTypes: ["touch"] }));

    swipe(host, { from: [0, 0], to: [200, 0], pointerType: "mouse" });
    assert.deepEqual(host.log, [], "a mouse drag is not this gesture");

    swipe(host, { from: [0, 0], to: [200, 0], pointerType: "touch" });
    assert.deepEqual(host.log, [1]);
  });

  it("lets only the pointer that started a gesture end it", async () => {
    const host = await mount(defineHost({ axis: "x" }));

    point(host, "pointerdown", { x: 0, y: 0, id: 1 });
    point(host, "pointerup", { x: 200, y: 0, id: 2 });
    assert.deepEqual(host.log, [], "a second finger lifting is not the first one's swipe");

    point(host, "pointerup", { x: 200, y: 0, id: 1 });
    assert.deepEqual(host.log, [1]);
  });

  it("forgets a half-finished gesture on teardown", async () => {
    const host = await mount(defineHost({ axis: "x" }));

    point(host, "pointerdown", { x: 0, y: 0 });
    host.remove();
    await tick();

    assert.equal(host._swipe, null);
    point(host, "pointerup", { x: 200, y: 0 });
    assert.deepEqual(host.log, []);
  });
});
