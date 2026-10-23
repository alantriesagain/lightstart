/**
 * `setPointerCapture` throws `NotFoundError` for a pointerId no real input
 * device owns, and no synthetic event can create an active pointer, so every
 * host here stubs the three capture methods. That is a deliberate narrowing:
 * what these cases prove is the bookkeeping (gating, one pointer at a time,
 * frame coalescing, teardown), not the platform's capture retargeting. A real
 * gesture belongs in an e2e journey where Playwright supplies the input.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import T from "@bootstrapp/light/types";
import View, { defineComponent } from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import { withPointerDrag } from "./pointer-drag.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

let seq = 0;

/**
 * @param {Parameters<typeof withPointerDrag>[0]} options
 * @returns {string}
 */
const defineHost = (options) => {
  const tag = `drag-host-${++seq}`;
  View.define(tag, defineComponent({
    mixins: [withPointerDrag(options)],
    tag,
    props: {
      resizable: false,
      log: /** @type {import("../types.ts").Prop<string[]>} */ (T.object({ reactive: false, defaultValue: null })),
    },
    connected() {
      this.log = [];
    },
    /** @param {import("../types.ts").DragStart} d */
    onDragStart({ x, y }) {
      this.log.push(`start ${x},${y}`);
    },
    /** @param {import("../types.ts").DragMove} d */
    onDragMove({ dx, dy }) {
      this.log.push(`move ${dx},${dy}`);
    },
    /** @param {import("../types.ts").DragEnd} d */
    onDragEnd({ dx, dy, cancelled }) {
      this.log.push(`end ${dx},${dy}${cancelled ? " cancelled" : ""}`);
    },
    render() {
      return html`<i part="grip"></i><em>plain</em>`;
    },
  }));
  return tag;
};

/** @type {Element[]} */
const mounted = [];

/** @param {string} tag */
const mount = async (tag) => {
  const host = /** @type {any} */ (document.createElement(tag));
  host.setPointerCapture = () => {};
  host.releasePointerCapture = () => {};
  host.hasPointerCapture = () => true;
  document.body.append(host);
  mounted.push(host);
  await tick();
  await host.$requestUpdate();
  return host;
};

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {{ x?: number, y?: number, id?: number, button?: number, pointerType?: string }} [init]
 */
const point = (target, type, { x = 0, y = 0, id = 1, button = 0, pointerType = "mouse" } = {}) =>
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: id,
    clientX: x,
    clientY: y,
    button,
    pointerType,
    bubbles: true,
    composed: true,
    cancelable: true,
  }));

/** @param {any} host */
const grip = (host) => /** @type {Element} */ (host.querySelector("[part=grip]"));

describe("@bootstrapp/light - withPointerDrag", () => {
  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("keeps two hosts dragged in one frame on their own coordinates", async () => {
    const tag = defineHost({});
    const a = await mount(tag);
    const b = await mount(tag);

    point(a, "pointerdown", { x: 100, y: 100 });
    point(b, "pointerdown", { x: 500, y: 500 });
    point(a, "pointermove", { x: 110, y: 100 });
    point(b, "pointermove", { x: 480, y: 500 });
    await frame();

    assert.deepEqual(a.log, ["start 100,100", "move 10,0"]);
    assert.deepEqual(b.log, ["start 500,500", "move -20,0"]);
  });

  it("coalesces every move in one frame into one call", async () => {
    const host = await mount(defineHost({}));

    point(host, "pointerdown", { x: 0, y: 0 });
    for (let x = 1; x <= 5; x++) point(host, "pointermove", { x, y: 0 });
    await frame();

    assert.deepEqual(host.log, ["start 0,0", "move 5,0"], "one call, carrying the latest position");
  });

  it("flushes the pending frame before it reports the end", async () => {
    const host = await mount(defineHost({}));

    point(host, "pointerdown", { x: 0, y: 0 });
    point(host, "pointermove", { x: 40, y: 12 });
    point(host, "pointerup", { x: 40, y: 12 });
    await frame();

    assert.deepEqual(host.log, ["start 0,0", "move 40,12", "end 40,12"], "the release never lands a frame behind");
  });

  it("reports a cancelled drag as cancelled", async () => {
    const host = await mount(defineHost({}));

    point(host, "pointerdown", { x: 0, y: 0 });
    point(host, "pointercancel", { x: 0, y: 0 });
    await frame();

    assert.deepEqual(host.log, ["start 0,0", "end 0,0 cancelled"]);
  });

  it("matches its handle inside its own tree, and only there", async () => {
    const tag = defineHost({ handle: "[part=grip]" });
    const host = await mount(tag);

    point(/** @type {EventTarget} */ (host.querySelector("em")), "pointerdown", { x: 0, y: 0 });
    await frame();
    assert.deepEqual(host.log, [], "a press that misses the handle starts nothing");

    point(grip(host), "pointerdown", { x: 7, y: 9 });
    await frame();
    assert.deepEqual(host.log, ["start 7,9"], "a press on the part starts the drag");
  });

  it("reads `enabled` at pointerdown, not at connect time", async () => {
    const host = await mount(defineHost({ enabled: "resizable" }));

    point(host, "pointerdown", { x: 0, y: 0 });
    await frame();
    assert.deepEqual(host.log, [], "disabled at mount, so nothing arms");

    host.resizable = true;
    await host.$requestUpdate();
    point(host, "pointerdown", { x: 3, y: 4 });
    await frame();
    assert.deepEqual(host.log, ["start 3,4"], "turning it on arms the drag without a remount");
  });

  it("ignores a non-primary mouse button", async () => {
    const host = await mount(defineHost({}));

    point(host, "pointerdown", { x: 0, y: 0, button: 2 });
    await frame();
    assert.deepEqual(host.log, []);
  });

  it("leaves a mouse alone when told to, and keeps a pen", async () => {
    const host = await mount(defineHost({ mouse: false }));
    point(host, "pointerdown", { x: 0, y: 0 });
    await frame();
    assert.deepEqual(host.log, []);
    point(host, "pointerdown", { x: 1, y: 1, pointerType: "pen" });
    point(host, "pointerup", { x: 1, y: 1, pointerType: "pen" });
    await frame();
    assert.deepEqual(host.log, ["start 1,1", "end 0,0"]);
  });

  it("hands a move back to the page when the host yields it, ending the drag as cancelled", async () => {
    const host = await mount(defineHost({}));
    host.dragYields = (/** @type {{ dx: number, dy: number }} */ { dy }) => dy < 0;
    point(host, "pointerdown", { x: 0, y: 10 });
    point(host, "pointermove", { x: 0, y: 20 });
    await frame();
    point(host, "pointermove", { x: 0, y: 0 });
    point(host, "pointermove", { x: 0, y: 40 });
    await frame();
    assert.deepEqual(host.log, ["start 0,10", "move 0,10", "end 0,10 cancelled"], "the yielded move and every one after it are the page's");
  });

  it("ignores a second pointer while one drag runs", async () => {
    const host = await mount(defineHost({}));

    point(host, "pointerdown", { x: 0, y: 0, id: 1 });
    point(host, "pointerdown", { x: 300, y: 300, id: 2 });
    point(host, "pointermove", { x: 300, y: 300, id: 2 });
    point(host, "pointermove", { x: 10, y: 0, id: 1 });
    await frame();

    assert.deepEqual(host.log, ["start 0,0", "move 10,0"], "the second finger never joins the first one's drag");
  });

  it("releases the pending frame when the host goes away mid-drag", async () => {
    const host = await mount(defineHost({}));

    point(host, "pointerdown", { x: 0, y: 0 });
    point(host, "pointermove", { x: 25, y: 0 });
    host.remove();
    await frame();

    assert.deepEqual(host.log, ["start 0,0"], "the queued frame never fires after teardown");
    assert.equal(host._drag, null, "and the drag state is gone");
  });

  it("drops its host listeners on teardown, so a remount does not double them", async () => {
    const tag = defineHost({});
    const host = await mount(tag);

    host.remove();
    await tick();
    document.body.append(host);
    await tick();

    point(host, "pointerdown", { x: 0, y: 0 });
    point(host, "pointermove", { x: 10, y: 0 });
    await frame();

    assert.deepEqual(host.log, ["start 0,0", "move 10,0"], "one listener set, so one call each");
  });
});
