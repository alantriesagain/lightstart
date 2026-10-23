import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import { ANCHOR_GUTTER_PX } from "./anchor.js";
import { env } from "@bootstrapp/light/env";

const { default: tooltipDef } = await import("./tooltip.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {{ position?: string, at?: [number, number] }} [opts] */
const mount = async ({ position, at = [400, 300] } = {}) => {
  const parent = document.createElement("div");
  parent.style.cssText = `position:fixed;left:${at[0]}px;top:${at[1]}px;width:100px;height:40px`;
  const tip = /** @type {any} */ (document.createElement("lc-tooltip"));
  tip.textContent = "Helpful information here";
  tip.setAttribute("delay", "0");
  if (position) tip.setAttribute("position", position);
  parent.append(tip);
  document.body.append(parent);
  mounted.push(parent);
  await tick();
  await tip.$requestUpdate();
  return { parent, tip };
};

/** @param {any} tip */
const shown = async (tip) => {
  tip.show();
  await tick();
  return {
    top: Number.parseFloat(tip.style.top),
    left: Number.parseFloat(tip.style.left),
    box: tip.getBoundingClientRect(),
  };
};

describe("@bootstrapp/light - lc-tooltip", () => {
  before(() => View.define("lc-tooltip", tooltipDef));

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("sits above its parent by default, lifted by its own height", async () => {
    const { parent, tip } = await mount();
    const at = await shown(tip);
    const anchor = parent.getBoundingClientRect();

    assert.ok(at.top < anchor.top, "above the trigger");
    assert.equal(Math.round(anchor.top - (at.top + at.box.height)), 6, "with the tooltip's own offset");
  });

  it("centres on its parent rather than starting at its edge", async () => {
    const { parent, tip } = await mount();
    const at = await shown(tip);
    const anchor = parent.getBoundingClientRect();

    assert.equal(
      Math.round(at.left + at.box.width / 2),
      Math.round(anchor.left + anchor.width / 2),
      "the two midpoints line up",
    );
  });

  it("writes no transform, because the position it writes is already the corner", async () => {
    const { tip } = await mount();
    await shown(tip);
    assert.equal(tip.style.transform, "");
  });

  it("stays inside the viewport when its parent is against the right edge", async () => {
    const { tip } = await mount({ position: "right", at: [env.width - 40, 300] });
    const at = await shown(tip);

    assert.ok(at.box.width > 0, "the tooltip has a real width to clamp");
    assert.ok(
      at.left + at.box.width <= env.width - ANCHOR_GUTTER_PX + 1,
      `left ${at.left} plus width ${at.box.width} must stay inside ${env.width}`,
    );
  });

  it("stays inside the viewport when its parent is against the top edge", async () => {
    const { tip } = await mount({ position: "top", at: [400, 0] });
    const at = await shown(tip);

    assert.ok(at.box.height > 0, "the tooltip has a real height to clamp");
    assert.ok(at.top >= ANCHOR_GUTTER_PX - 1, `top ${at.top} must clear the gutter`);
  });

  it("drops a pending show when it is hidden first", async () => {
    const { tip } = await mount();
    tip.setAttribute("delay", "50");
    await tip.$requestUpdate();

    tip.show();
    tip.hide();
    await new Promise((resolve) => setTimeout(resolve, 70));

    assert.equal(tip._showTimer, null, "the timer was cleared, so nothing shows late");
  });
});
