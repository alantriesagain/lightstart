import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: flowDef } = await import("./flow.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const PHASES = ["Write", "Build", "Run"];
const LANES = [
  {
    id: "web",
    label: "Browser",
    steps: [
      { id: "web-source", label: "app.js", phase: 0 },
      { id: "web-run", label: "Engine", phase: 2 },
    ],
  },
  {
    id: "native",
    label: "Native",
    steps: [
      { id: "native-source", label: "app.ts", phase: 0 },
      { id: "native-compile", label: "Compile", phase: 1, tone: "accent" },
      { id: "native-link", label: "Link", phase: 1 },
      { id: "native-run", label: "Executable", phase: 2 },
    ],
  },
];

/** @type {Element[]} */
const mounted = [];

/**
 * @param {Record<string, unknown>} props
 * @param {string} [width]
 */
const mount = async (props, width = "800px") => {
  const el = /** @type {any} */ (document.createElement("lc-flow"));
  Object.assign(el, { phases: PHASES, lanes: LANES }, props);
  el.style.width = width;
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {Element} el */
const box = (el) => el.getBoundingClientRect();

describe("@bootstrapp/light - lc-flow", () => {
  before(async () => {
    if (!customElements.get("lc-flow")) View.define("lc-flow", flowDef);
    const style = document.createElement("style");
    style.textContent = await (await fetch(new URL("./flow.css", import.meta.url))).text();
    document.head.append(style);
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("lines the lanes up under their phases", async () => {
    const el = await mount({});
    const headings = [...el.querySelectorAll(".flow-phase")];
    assert.deepEqual(headings.map((node) => node.textContent), PHASES);
    const step = (id) => [...el.querySelectorAll(".flow-step")].find((node) => node.textContent.includes(id));
    assert.ok(Math.abs(box(step("Engine")).left - box(headings[2]).left) <= 1, "a run step sits under Run");
    assert.ok(Math.abs(box(step("Compile")).left - box(headings[1]).left) <= 1, "a build step sits under Build");
    assert.ok(box(step("Link")).left > box(step("Compile")).right, "two steps of one phase share its column");
  });

  it("draws a line through a phase a lane skips, and arrows from each step to the next", async () => {
    const el = await mount({});
    const cells = [...el.querySelectorAll(".flow-cell")];
    assert.deepEqual(cells.map((cell) => cell.hasAttribute("data-pass")), [false, true, false, false, false, false]);
    const after = [...el.querySelectorAll(".flow-step")].map((node) => node.hasAttribute("data-after"));
    assert.deepEqual(after, [false, true, false, true, true, true], "every step but a lane's first has an arrow");
  });

  it("selects a step on press and reports its lane", async () => {
    const el = await mount({ selected: "web-source" });
    /** @type {{ lane: string, step: string }[]} */
    const events = [];
    el.addEventListener("flow-select", (/** @type {CustomEvent} */ e) => events.push(e.detail));
    const compile = [...el.querySelectorAll(".flow-step")].find((node) => node.textContent.includes("Compile"));
    compile.click();
    await el.$requestUpdate();
    assert.deepEqual(events, [{ lane: "native", step: "native-compile" }]);
    assert.equal(el.selected, "native-compile");
    assert.equal(compile.getAttribute("aria-pressed"), "true");
    assert.equal(el.querySelectorAll('[aria-pressed="true"]').length, 1);
    compile.click();
    assert.equal(events.length, 1, "pressing the selected step again reports nothing");
  });

  it("stacks the lanes in a narrow container, each step naming its phase", async () => {
    const el = await mount({}, "320px");
    const steps = [...el.querySelectorAll(".flow-step")];
    assert.ok(steps.every((node) => Math.abs(box(node).left - box(steps[0]).left) <= 1), "one column");
    assert.ok(box(steps[1]).top > box(steps[0]).bottom, "each step below the one before");
    assert.equal(getComputedStyle(steps[0].querySelector(".flow-step-phase")).display, "block");
    assert.equal(getComputedStyle(el.querySelector(".flow-phase")).display, "none");
  });
});
