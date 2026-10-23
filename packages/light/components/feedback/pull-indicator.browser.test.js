import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import View from "@bootstrapp/light";
import indicator from "./pull-indicator.js";

View.define("lc-pull-indicator", indicator);

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = async (props) => {
  const el = /** @type {any} */ (document.createElement("lc-pull-indicator"));
  Object.assign(el, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {any} el */
const band = (el) => /** @type {HTMLElement} */ (el.querySelector(".lc-pull-indicator-band"));

describe("@bootstrapp/light - lc-pull-indicator", () => {
  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
  });

  it("draws nothing at rest", async () => {
    const el = await mount({});
    assert.equal(band(el).style.height, "0px");
    assert.equal(el.querySelector(".lc-pull-indicator-knob"), null);
    assert.equal(el.hasAttribute("open"), false);
  });

  it("follows the pull, and says a release refreshes once past the threshold", async () => {
    const el = await mount({ pull: 30, threshold: 64 });
    assert.equal(band(el).style.height, "30px");
    assert.ok(el.querySelector(".lc-pull-indicator-knob lc-icon"));
    assert.equal(el.hasAttribute("ready"), false);
    assert.equal(band(el).getAttribute("aria-label"), "Pull to refresh");

    el.pull = 70;
    await el.$requestUpdate();
    assert.equal(el.hasAttribute("ready"), true);
    assert.equal(band(el).getAttribute("aria-label"), "Release to refresh");
  });

  it("shows a spinner while refreshing, however far it was pulled", async () => {
    const el = await mount({ pull: 0, refreshing: true });
    assert.ok(el.querySelector(".lc-pull-indicator-knob lc-spinner"));
    assert.equal(el.hasAttribute("ready"), false);
    assert.equal(el.hasAttribute("open"), false, "the band eases to its refreshing height");
    assert.equal(band(el).getAttribute("aria-label"), "Refreshing");
  });
});
