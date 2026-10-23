import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: dividerDef } = await import("./divider.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

/** @type {HTMLElement} */
let row;

const build = async (/** @type {{ vertical?: boolean, resizable?: boolean, attrs?: Record<string, string> }} */ opts = {}) => {
  row = document.createElement("div");
  row.style.cssText = `display:flex;flex-direction:${opts.vertical ? "row" : "column"};width:400px;height:400px`;
  const prev = document.createElement("div");
  const next = document.createElement("div");
  prev.style.flexBasis = "100px";
  next.style.flexBasis = "100px";
  const divider = /** @type {any} */ (document.createElement("lc-divider"));
  divider.setPointerCapture = () => {};
  divider.releasePointerCapture = () => {};
  divider.hasPointerCapture = () => true;
  if (opts.vertical) divider.setAttribute("vertical", "");
  if (opts.resizable !== false) divider.setAttribute("resizable", "");
  for (const [name, value] of Object.entries(opts.attrs || {})) divider.setAttribute(name, value);
  row.append(prev, divider, next);
  document.body.append(row);
  await tick();
  await divider.$requestUpdate();
  return { prev, next, divider };
};

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {number} x
 * @param {number} y
 */
const point = (target, type, x, y) =>
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: 1, clientX: x, clientY: y, button: 0, pointerType: "mouse",
    bubbles: true, composed: true, cancelable: true,
  }));

describe("@bootstrapp/light - lc-divider", () => {
  before(() => View.define("lc-divider", dividerDef));
  after(() => row?.remove());

  it("resizes both siblings by the distance dragged, and no more", async () => {
    const { prev, next, divider } = await build({ vertical: true });

    point(divider, "pointerdown", 200, 200);
    point(divider, "pointermove", 230, 200);
    await frame();

    assert.equal(prev.style.flexBasis, "130px", "the previous sibling grew by exactly the drag");
    assert.equal(next.style.flexBasis, "70px", "and the next one gave up exactly the same");

    row.remove();
  });

  it("moves the same distance in either direction", async () => {
    const dragged = async (/** @type {number} */ dx) => {
      const { prev, divider } = await build({ vertical: true });
      point(divider, "pointerdown", 200, 200);
      point(divider, "pointermove", 200 + dx, 200);
      await frame();
      const moved = parseFloat(prev.style.flexBasis) - 100;
      row.remove();
      await tick();
      return moved;
    };

    assert.equal(await dragged(40), 40, "40px right moves it 40px");
    assert.equal(await dragged(-40), -40, "40px left moves it 40px the other way");
  });

  it("stays put when it is not resizable", async () => {
    const { prev, divider } = await build({ vertical: true, resizable: false });

    point(divider, "pointerdown", 200, 200);
    point(divider, "pointermove", 260, 200);
    await frame();

    assert.equal(prev.style.flexBasis, "100px");

    row.remove();
  });

  it("arms as soon as resizable is turned on, with no remount", async () => {
    const { prev, divider } = await build({ vertical: true, resizable: false });

    divider.resizable = true;
    await divider.$requestUpdate();
    point(divider, "pointerdown", 200, 200);
    point(divider, "pointermove", 225, 200);
    await frame();

    assert.equal(prev.style.flexBasis, "125px", "the gate is read at pointerdown, not at connect time");

    row.remove();
  });

  it("drags along the other axis when it is horizontal", async () => {
    const { prev, next, divider } = await build({ vertical: false });

    point(divider, "pointerdown", 200, 200);
    point(divider, "pointermove", 200, 180);
    await frame();

    assert.equal(prev.style.flexBasis, "80px");
    assert.equal(next.style.flexBasis, "120px");

    row.remove();
  });

  it("refuses a drag that would collapse a sibling", async () => {
    const { prev, next, divider } = await build({ vertical: true });

    point(divider, "pointerdown", 200, 200);
    point(divider, "pointermove", 200 - 150, 200);
    await frame();

    assert.equal(prev.style.flexBasis, "100px", "a negative size is never written");
    assert.equal(next.style.flexBasis, "100px");

    row.remove();
  });

  it("stops at the minimum a side declares and gives the rest to the other side", async () => {
    const { prev, next, divider } = await build({ vertical: true, attrs: { "min-prev": "80" } });

    point(divider, "pointerdown", 200, 200);
    point(divider, "pointermove", 200 - 60, 200);
    await frame();

    assert.equal(prev.style.flexBasis, "80px", "the drag past the minimum is held at it");
    assert.equal(next.style.flexBasis, "120px", "the other side takes what the total allows");

    row.remove();
  });

  it("stops at the maximum a side declares", async () => {
    const { prev, next, divider } = await build({ vertical: true, attrs: { "max-next": "150" } });

    point(divider, "pointerdown", 200, 200);
    point(divider, "pointermove", 200 - 150, 200);
    await frame();

    assert.equal(next.style.flexBasis, "150px", "the side with a maximum stops growing there");
    assert.equal(prev.style.flexBasis, "50px", "and the other side keeps the remainder");

    row.remove();
  });

  it("lifts a remembered size that fell under the minimum", async () => {
    const { prev, divider } = await build({ vertical: true, attrs: { "min-prev": "80" } });
    divider.key = "divider-probe";
    divider.prevSize = 20;
    divider._restoreSizes();
    assert.equal(prev.style.flexBasis, "80px");

    row.remove();
  });
});
