import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: pieChartDef } = await import("./pie-chart.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const DATA = [{ label: "A", value: 3 }, { label: "B", value: 1 }];

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = async (props) => {
  const el = /** @type {any} */ (document.createElement("lc-pie-chart"));
  Object.assign(el, { data: DATA }, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-pie-chart centre label", () => {
  before(async () => {
    if (!customElements.get("lc-pie-chart")) View.define("lc-pie-chart", pieChartDef);
    const style = document.createElement("style");
    style.textContent = await (await fetch(new URL("./pie-chart.css", import.meta.url))).text();
    document.head.append(style);
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws the label and its sub line in the middle of the donut", async () => {
    const el = await mount({ donut: true, centerLabel: "12.4K", centerSub: "visits", showLegend: false });
    assert.equal(el.getAttribute("center-label"), "12.4K");
    assert.equal(el.querySelector(".pie-center-label").textContent, "12.4K");
    assert.equal(el.querySelector(".pie-center-sub").textContent, "visits");
    const svg = el.querySelector("svg").getBoundingClientRect();
    const text = el.querySelector(".pie-center-text").getBoundingClientRect();
    assert.ok(Math.abs(svg.left + svg.width / 2 - (text.left + text.width / 2)) <= 1, "centred across");
    assert.ok(Math.abs(svg.top + svg.height / 2 - (text.top + text.height / 2)) <= 1, "and down");
  });

  it("draws nothing in the middle of a plain pie or without a label", async () => {
    const pie = await mount({ centerLabel: "12.4K" });
    assert.equal(pie.querySelector(".pie-center-text"), null);
    const donut = await mount({ donut: true });
    assert.equal(donut.querySelector(".pie-center-text"), null);
  });
});
