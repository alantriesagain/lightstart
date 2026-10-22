import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: chartDef } = await import("./line-chart.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = async (props) => {
  const el = /** @type {any} */ (document.createElement("lc-line-chart"));
  Object.assign(el, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

const DATA = [{ label: "a", value: 3 }, { label: "b", value: 8 }, { label: "c", value: 5 }];

const PROPS = { data: DATA };

describe("@bootstrapp/light - lc-line-chart area", () => {
  before(async () => {
    if (!customElements.get("lc-line-chart")) View.define("lc-line-chart", chartDef);
    const css = await (await fetch(new URL("./line-chart.css", import.meta.url))).text();
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

describe("@bootstrapp/light - lc-line-chart scale", () => {
  before(async () => {
    if (!customElements.get("lc-line-chart")) View.define("lc-line-chart", chartDef);
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  const WEIGHTS = [{ label: "a", value: 80 }, { label: "b", value: 79 }, { label: "c", value: 78 }];
  /** @param {Element} el */
  const dotYs = (el) => [...el.querySelectorAll("circle.line-dot")].map((dot) => Number(dot.getAttribute("cy")));

  it("starts the scale at zero, so close values sit together near the top", async () => {
    const el = await mount({ data: WEIGHTS, showLabels: false });
    const [first, , last] = dotYs(el);
    assert.ok(last - first < 3, `${first} and ${last} are close`);
  });

  it("with fit, spans the values' own range, so their change shows", async () => {
    const el = await mount({ data: WEIGHTS, showLabels: false, fit: true });
    const [first, , last] = dotYs(el);
    assert.ok(last - first > 50, `${first} to ${last} spans the chart`);
  });

  it("draws a reference value as a dashed line, inside a fitted scale", async () => {
    const el = await mount({ data: WEIGHTS, showLabels: false, fit: true, reference: 75 });
    const line = el.querySelector("line.line-reference");
    assert.ok(line, "the reference line is drawn");
    const y = Number(line.getAttribute("y1"));
    assert.ok(y > Math.max(...dotYs(el)), "below every point, since 75 is the lowest value");
    assert.ok(y < 100, "inside the chart");
    const plain = await mount({ data: WEIGHTS });
    assert.equal(plain.querySelector("line.line-reference"), null);
  });
});
