import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: chartDef } = await import("./sparkline.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = async (props) => {
  const el = /** @type {any} */ (document.createElement("lc-sparkline"));
  Object.assign(el, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

const PROPS = { data: [3, 8, 5] };

describe("@bootstrapp/light - lc-sparkline area", () => {
  before(async () => {
    if (!customElements.get("lc-sparkline")) View.define("lc-sparkline", chartDef);
    const css = await (await fetch(new URL("./sparkline.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    document.documentElement.style.setProperty("--color-primary", "rgb(0, 0, 255)");
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("fills the area with a vertical gradient from the line colour to nothing", async () => {
    const el = await mount({ ...PROPS, showArea: true });
    const gradient = el.querySelector("linearGradient");
    assert.ok(gradient, "the gradient is drawn");
    assert.equal(gradient.getAttribute("y2"), "1");
    const area = el.querySelector('path[fill^="url("]');
    assert.equal(area.getAttribute("fill"), `url(#${gradient.id})`);
    const [top, bottom] = [...gradient.querySelectorAll("stop")].map((stop) => getComputedStyle(stop));
    assert.equal(top.stopColor, "rgb(0, 0, 255)");
    assert.equal(Number(top.stopOpacity), 0.28);
    assert.equal(Number(bottom.stopOpacity), 0);
  });

  it("gives each instance its own gradient id", async () => {
    const first = await mount({ ...PROPS, showArea: true });
    const second = await mount({ ...PROPS, showArea: true });
    const ids = [first, second].map((el) => el.querySelector("linearGradient").id);
    assert.notEqual(ids[0], ids[1]);
    await first.$requestUpdate();
    assert.equal(first.querySelector("linearGradient").id, ids[0], "and keeps it across renders");
  });

  it("draws no gradient without showArea", async () => {
    const el = await mount(PROPS);
    assert.equal(el.querySelector("linearGradient"), null);
  });
});
