import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import T from "@bootstrapp/light/types";
import View, { defineComponent } from "@bootstrapp/light";
import { withPullToRefresh } from "./pull-to-refresh.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

let seq = 0;

/** @param {Parameters<typeof withPullToRefresh>[0]} [options] */
const defineHost = (options) => {
  const tag = `pull-host-${++seq}`;
  View.define(tag, defineComponent({
    mixins: [withPullToRefresh({ mouse: true, ...options })],
    tag,
    props: {
      armed: true,
      calls: T.number({ reactive: false, defaultValue: 0 }),
      _release: /** @type {import("../types.ts").Prop<((v?: unknown) => void) | null>} */ (T.object({ reactive: false, defaultValue: null })),
    },
    onRefresh() {
      this.calls++;
      return new Promise((resolve) => { this._release = resolve; });
    },
  }));
  return tag;
};

/** @type {Element[]} */
const mounted = [];

/** @param {string} tag @param {number} [scrollTop] */
const mount = async (tag, scrollTop = 0) => {
  const scroller = document.createElement("div");
  scroller.setAttribute("data-scroller", "");
  scroller.style.cssText = "height:80px;overflow:auto";
  const filler = document.createElement("div");
  filler.style.height = "400px";
  const host = /** @type {any} */ (document.createElement(tag));
  scroller.append(host, filler);
  document.body.append(scroller);
  mounted.push(scroller);
  scroller.scrollTop = scrollTop;
  await tick();
  return host;
};

/** @param {EventTarget} target @param {string} type @param {{ y?: number }} [init] */
const point = (target, type, { y = 0 } = {}) =>
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: 1, clientX: 0, clientY: y, button: 0, pointerType: "mouse",
    bubbles: true, composed: true, cancelable: true,
  }));

/** @param {Element} target @param {string} type @param {number} y @param {number} [x] */
const touch = (target, type, y, x = 0) => {
  const spot = new Touch({ identifier: 1, target, clientX: x, clientY: y });
  const list = type === "touchend" || type === "touchcancel" ? [] : [spot];
  return target.dispatchEvent(new TouchEvent(type, {
    touches: list, targetTouches: list, changedTouches: [spot],
    bubbles: true, composed: true, cancelable: true,
  }));
};

const pull = async (host, distance, { end = "pointerup" } = {}) => {
  point(host, "pointerdown", { y: 0 });
  point(host, "pointermove", { y: distance });
  await frame();
  point(host, end, { y: distance });
  await tick();
};

const pullByTouch = async (host, distance, { end = "touchend" } = {}) => {
  touch(host, "touchstart", 0);
  touch(host, "touchmove", distance);
  await frame();
  touch(host, end, distance);
  await tick();
};

describe("@bootstrapp/light - withPullToRefresh", () => {
  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("refreshes on a pull from the top past the threshold", async () => {
    const host = await mount(defineHost({ threshold: 40 }));

    await pull(host, 200);
    assert.equal(host.calls, 1);
    assert.equal(host.refreshing, true, "and stays refreshing until the host's promise settles");

    host._release();
    await tick();
    assert.equal(host.refreshing, false);
  });

  it("ignores a pull that stops short of the threshold", async () => {
    const host = await mount(defineHost({ threshold: 64, resistance: 0.5 }));

    await pull(host, 100);
    assert.equal(host.calls, 0, "100px at half resistance is 50, which is not 64");

    await pull(host, 200);
    assert.equal(host.calls, 1);
  });

  it("does not arm mid-list, so a pull that starts scrolled down stays a scroll", async () => {
    const host = await mount(defineHost({ threshold: 40 }), 120);

    await pull(host, 300);
    assert.equal(host.calls, 0);
    assert.equal(host.pullY, 0, "and nothing follows the finger either");
  });

  it("ignores a push upwards", async () => {
    const host = await mount(defineHost({ threshold: 40 }));

    await pull(host, -300);
    assert.equal(host.calls, 0);
  });

  it("ignores a cancelled gesture", async () => {
    const host = await mount(defineHost({ threshold: 40 }));

    await pull(host, 300, { end: "pointercancel" });
    assert.equal(host.calls, 0, "a gesture the browser took back is not a request to reload");
  });

  it("refreshes from a touch, which is how a phone makes the gesture", async () => {
    const host = await mount(defineHost({ threshold: 40 }));

    await pullByTouch(host, 300);
    assert.equal(host.calls, 1);
    host._release();
    await tick();
  });

  it("ignores a cancelled touch and a touch that starts mid-list", async () => {
    const host = await mount(defineHost({ threshold: 40 }));
    await pullByTouch(host, 300, { end: "touchcancel" });
    assert.equal(host.calls, 0);

    const scrolled = await mount(defineHost({ threshold: 40 }), 120);
    await pullByTouch(scrolled, 300);
    assert.equal(scrolled.calls, 0);
  });

  it("holds the page only for a pull down from the top, and hands every other move back to scroll", async () => {
    const host = await mount(defineHost({ threshold: 40 }));
    touch(host, "touchstart", 0);
    assert.equal(touch(host, "touchmove", 30), false, "a pull down from the top holds the page");
    touch(host, "touchend", 30);
    await tick();
    host._release?.();

    const up = await mount(defineHost({ threshold: 40 }));
    touch(up, "touchstart", 100);
    assert.equal(touch(up, "touchmove", 60), true, "a finger going up scrolls");
    assert.equal(touch(up, "touchmove", 200), true, "and stays a scroll once handed back");
    touch(up, "touchend", 200);
    await tick();
    assert.equal(up.calls, 0);

    const sideways = await mount(defineHost({ threshold: 40 }));
    touch(sideways, "touchstart", 0, 0);
    assert.equal(touch(sideways, "touchmove", 10, 80), true, "a sideways swipe belongs to the row under it");
    touch(sideways, "touchend", 10, 80);
    await tick();
    assert.equal(sideways.calls, 0);

    const scrolled = await mount(defineHost({ threshold: 40 }), 120);
    touch(scrolled, "touchstart", 0);
    assert.equal(touch(scrolled, "touchmove", 60), true, "mid-list the page scrolls");
    touch(scrolled, "touchend", 60);
    await tick();
    assert.equal(scrolled.calls, 0);
  });

  it("leaves a mouse alone unless asked, and finds a data-scroll-root scroller", async () => {
    const tag = `pull-host-${++seq}`;
    View.define(tag, defineComponent({
      mixins: [withPullToRefresh({ threshold: 40 })],
      tag,
      props: { calls: T.number({ reactive: false, defaultValue: 0 }) },
      onRefresh() { this.calls++; },
    }));
    const host = await mount(tag);
    await pull(host, 300);
    assert.equal(host.calls, 0, "a mouse drag stays a selection");

    const root = await mount(defineHost({ threshold: 40 }), 120);
    const scroller = root.parentElement;
    scroller.removeAttribute("data-scroller");
    scroller.setAttribute("data-scroll-root", "");
    await pullByTouch(root, 300);
    assert.equal(root.calls, 0, "scrolled down under a data-scroll-root, so not armed");
  });

  it("follows the finger at the resistance it was given, and stops at max", async () => {
    const host = await mount(defineHost({ resistance: 0.5, max: 60 }));

    point(host, "pointerdown", { y: 0 });
    point(host, "pointermove", { y: 40 });
    await frame();
    assert.equal(host.pullY, 20, "half of 40");

    point(host, "pointermove", { y: 400 });
    await frame();
    assert.equal(host.pullY, 60, "and never past max");

    point(host, "pointerup", { y: 400 });
    await tick();
    assert.equal(host.pullY, 0, "released, the hint goes back");
  });

  it("takes one pull at a time", async () => {
    const host = await mount(defineHost({ threshold: 40 }));

    await pull(host, 300);
    assert.equal(host.calls, 1);

    await pull(host, 300);
    assert.equal(host.calls, 1, "a second pull while the first is still running asks nothing");

    host._release();
    await tick();
    await pull(host, 300);
    assert.equal(host.calls, 2, "and once it settles the gesture works again");
  });

  it("stays disarmed while the host says so", async () => {
    const host = await mount(defineHost({ threshold: 40, enabled: "armed" }));
    host.armed = false;
    await tick();

    await pull(host, 300);
    assert.equal(host.calls, 0, "signed out there is nothing to refresh");

    host.armed = true;
    await tick();
    await pull(host, 300);
    assert.equal(host.calls, 1);
  });
});
