import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: barChartDef } = await import("./bar-chart.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const DATA = [
  { label: "Mon", value: 1200 },
  { label: "Tue", value: 3100 },
  { label: "Wed", value: 0 },
  { label: "Thu", value: 2400 },
];

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} props */
const mount = async (props) => {
  const el = /** @type {any} */ (document.createElement("lc-bar-chart"));
  Object.assign(el, { data: DATA }, props);
  el.style.width = "400px";
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-bar-chart", () => {
  before(async () => {
    if (!customElements.get("lc-bar-chart")) View.define("lc-bar-chart", barChartDef);
    const style = document.createElement("style");
    style.textContent = await (await fetch(new URL("./bar-chart.css", import.meta.url))).text();
    document.head.append(style);
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    document.documentElement.style.removeProperty("--color-primary");
    await tick();
  });

  it("draws no axis unless asked", async () => {
    const el = await mount({});
    assert.equal(el.querySelector(".bar-gridline"), null);
    assert.equal(el.querySelectorAll(".bar-label").length, 4);
  });

  it("draws five gridlines with compact tick labels over a rounded scale", async () => {
    const el = await mount({ showAxis: true, height: 200 });
    assert.equal(el.getAttribute("show-axis"), "");
    const lines = [...el.querySelectorAll(".bar-gridline")];
    assert.equal(lines.length, 5);
    const ticks = [...el.querySelectorAll(".bar-tick")].map((node) => node.textContent.trim());
    assert.deepEqual(ticks, ["0", "1K", "2K", "3K", "4K"]);
    const plot = el.querySelector(".bar-plot").getBoundingClientRect();
    const bottomLine = lines[0].getBoundingClientRect();
    const topLine = lines[4].getBoundingClientRect();
    assert.ok(Math.abs(bottomLine.top - plot.bottom) <= 1, "the zero line sits on the plot's floor");
    assert.ok(Math.abs(topLine.top - plot.top) <= 1, "the top line on its ceiling");
    const tuesday = el.querySelectorAll(".bar")[1].getBoundingClientRect();
    assert.ok(Math.abs(tuesday.height - plot.height * (3100 / 4000)) <= 1, "a bar is measured against the rounded top");
    assert.equal(el.querySelectorAll(".bar-chart-labels .bar-label").length, 4, "labels sit in their own row under the plot");
  });

  it("labels ticks through formatValue when given one", async () => {
    const el = await mount({ showAxis: true, formatValue: (value) => `$${value}` });
    assert.deepEqual([...el.querySelectorAll(".bar-tick")].map((node) => node.textContent.trim()), ["$0", "$1000", "$2000", "$3000", "$4000"]);
  });

  it("lays a horizontal chart out as label, bar and value, each bar a share of the same track", async () => {
    const el = await mount({ horizontal: true, showValues: true });
    const groups = [...el.querySelectorAll(".bar-group")];
    const first = groups[0];
    const [label, track, value] = [first.querySelector(".bar-label"), first.querySelector(".bar-track"), first.querySelector(".bar-value")].map((node) => node.getBoundingClientRect());
    assert.ok(label.right <= track.left + 1 && track.right <= value.left + 1, "label, then the bar's track, then the value");
    assert.ok(Math.abs(label.left - el.getBoundingClientRect().left) <= 1, "the row starts at the chart's left edge");
    for (const node of el.querySelectorAll(".bar-label")) assert.ok(node.scrollWidth <= node.clientWidth, `"${node.textContent}" is not cut off`);
    const widths = groups.map((group) => group.querySelector(".bar").getBoundingClientRect().width);
    const tracks = groups.map((group) => group.querySelector(".bar-track").getBoundingClientRect().width);
    assert.ok(Math.abs(widths[1] - tracks[1]) <= 1, "the largest value fills its track");
    assert.ok(Math.abs(widths[0] - tracks[0] * (1200 / 3100)) <= 1, "a bar is its value's share of the track");
  });

  it("draws the callout as a bubble over the current bar in the primary colour", async () => {
    document.documentElement.style.setProperty("--color-primary", "rgb(10, 20, 30)");
    const el = await mount({ currentIndex: 1, callout: "3.1K" });
    const bubbles = el.querySelectorAll(".bar-callout");
    assert.equal(bubbles.length, 1);
    const bubble = bubbles[0];
    assert.equal(bubble.textContent, "3.1K");
    assert.equal(bubble.closest(".bar-group"), el.querySelectorAll(".bar-group")[1]);
    assert.equal(getComputedStyle(bubble).backgroundColor, "rgb(10, 20, 30)");
    assert.equal(getComputedStyle(bubble, "::after").borderTopColor, "rgb(10, 20, 30)");
    const bar = bubble.parentElement.getBoundingClientRect();
    assert.ok(bubble.getBoundingClientRect().bottom <= bar.top, "the bubble sits above its bar");
    assert.equal(el.querySelector(".bar-value"), null, "the bubble replaces the current bar's value");
  });
});
