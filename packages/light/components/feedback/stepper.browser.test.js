import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: stepperDef } = await import("./stepper.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @param {string[]} names */
const loadStyles = async (...names) => {
  const css = (await Promise.all(names.map(async (name) =>
    (await fetch(new URL(`./${name}.css`, import.meta.url))).text()))).join("\n");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  await tick();
};

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "process", label: "Process" },
  { id: "publish", label: "Publish" },
];

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} [props] */
const mount = async (props = {}) => {
  const el = Object.assign(document.createElement("lc-stepper"), { steps: STEPS }, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {Element} el */
const statesOf = (el) => [...el.querySelectorAll(".stepper-step")].map((step) => step.getAttribute("data-state"));

/** @param {Element} el @param {string} id */
const stepOf = (el, id) => el.querySelector(`.stepper-step[data-step="${id}"]`);

describe("@bootstrapp/light - lc-stepper", () => {
  before(async () => {
    if (!customElements.get("lc-stepper")) View.define("lc-stepper", stepperDef);
    await loadStyles("stepper");
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    document.documentElement.style.removeProperty("--color-danger");
    document.documentElement.style.removeProperty("--color-primary");
    await tick();
  });

  it("draws a numbered dot and a label per step, in a row", async () => {
    const el = await mount({ current: "upload" });
    const steps = [...el.querySelectorAll(".stepper-step")];
    assert.deepEqual(steps.map((step) => step.querySelector(".stepper-label").textContent), ["Upload", "Process", "Publish"]);
    assert.deepEqual(steps.map((step) => step.querySelector(".stepper-dot").textContent.trim()), ["1", "2", "3"]);
    assert.equal(getComputedStyle(el.querySelector(".stepper-steps")).display, "flex");
    const [first, second] = steps.map((step) => step.getBoundingClientRect());
    assert.ok(second.left >= first.right - 1, "the second step sits beside the first, not under it");
  });

  it("while idle the current step is active and the rest wait", async () => {
    const el = await mount({ current: "process" });
    assert.deepEqual(statesOf(el), ["done", "active", "pending"]);
    assert.equal(stepOf(el, "process").getAttribute("aria-current"), "step");
    assert.equal(stepOf(el, "upload").getAttribute("aria-current"), null);
    assert.equal(stepOf(el, "upload").querySelector("lc-icon").getAttribute("name"), "check");
  });

  it("running puts a spinner in the current dot", async () => {
    const el = await mount({ current: "process", state: "running" });
    assert.deepEqual(statesOf(el), ["done", "running", "pending"]);
    assert.ok(stepOf(el, "process").querySelector("lc-spinner"), "the running step spins");
    assert.equal(stepOf(el, "publish").querySelector(".stepper-dot").textContent.trim(), "3");
  });

  it("done checks the current step, and done with no current checks every step", async () => {
    const el = await mount({ current: "publish", state: "done" });
    assert.deepEqual(statesOf(el), ["done", "done", "done"]);
    assert.equal(stepOf(el, "publish").querySelector("lc-icon").getAttribute("name"), "check");

    el.current = "";
    await el.$requestUpdate();
    assert.deepEqual(statesOf(el), ["done", "done", "done"]);

    el.state = "idle";
    await el.$requestUpdate();
    assert.deepEqual(statesOf(el), ["pending", "pending", "pending"], "no current and not done means nothing has started");
  });

  it("failed marks the current step with an x and draws the error under the row in the danger colour", async () => {
    document.documentElement.style.setProperty("--color-danger", "rgb(200, 10, 20)");
    const el = await mount({ current: "publish", state: "failed", error: "The media URL did not answer." });
    assert.deepEqual(statesOf(el), ["done", "done", "failed"]);
    assert.equal(stepOf(el, "publish").querySelector("lc-icon").getAttribute("name"), "x");
    const error = el.querySelector(".stepper-error");
    assert.equal(error.textContent, "The media URL did not answer.");
    assert.equal(error.getAttribute("role"), "alert");
    assert.equal(getComputedStyle(error).color, "rgb(200, 10, 20)");
    assert.ok(error.getBoundingClientRect().top >= el.querySelector(".stepper-steps").getBoundingClientRect().bottom - 1);
  });

  it("an error is drawn only while the state is failed", async () => {
    const el = await mount({ current: "process", state: "running", error: "stale" });
    assert.equal(el.querySelector(".stepper-error"), null);
    el.state = "failed";
    await el.$requestUpdate();
    assert.equal(el.querySelector(".stepper-error").textContent, "stale");
    el.error = "";
    await el.$requestUpdate();
    assert.equal(el.querySelector(".stepper-error"), null, "failed with no reason draws no empty line");
  });

  it("the line into a reached step takes the primary colour, the line into a waiting one does not", async () => {
    document.documentElement.style.setProperty("--color-primary", "rgb(1, 2, 3)");
    const el = await mount({ current: "process", state: "running" });
    const into = (/** @type {string} */ id) => getComputedStyle(stepOf(el, id), "::before");
    assert.equal(getComputedStyle(stepOf(el, "upload"), "::before").content, "none", "the first step has no line before it");
    assert.equal(into("process").backgroundColor, "rgb(1, 2, 3)");
    assert.notEqual(into("publish").backgroundColor, "rgb(1, 2, 3)");
  });

  it("size sm draws smaller dots", async () => {
    const md = await mount({ current: "upload" });
    const sm = await mount({ current: "upload", size: "sm" });
    assert.equal(sm.getAttribute("size"), "sm");
    const width = (/** @type {Element} */ el) => el.querySelector(".stepper-dot").getBoundingClientRect().width;
    assert.ok(width(sm) < width(md), `${width(sm)} is not under ${width(md)}`);
  });

  it("vertical draws a column of 16px rings with the label and description beside each", async () => {
    document.documentElement.style.setProperty("--color-success", "rgb(0, 128, 0)");
    try {
      const el = await mount({
        vertical: true,
        steps: [
          { id: "a", label: "Connect", description: "Link the account", done: true },
          { id: "b", label: "Publish", description: "Send it out" },
          { id: "c", label: "Review" },
        ],
        current: "b",
      });
      assert.equal(el.hasAttribute("vertical"), true);
      assert.deepEqual(statesOf(el), ["done", "active", "pending"]);
      assert.equal(getComputedStyle(el.querySelector(".stepper-steps")).flexDirection, "column");
      const [first, second] = [...el.querySelectorAll(".stepper-step")].map((step) => step.getBoundingClientRect());
      assert.ok(second.top >= first.bottom - 1, "the second step sits under the first");
      const dot = stepOf(el, "a").querySelector(".stepper-dot");
      assert.equal(dot.getBoundingClientRect().width, 16);
      assert.equal(getComputedStyle(dot).backgroundColor, "rgb(0, 128, 0)");
      assert.equal(dot.querySelector("lc-icon").getAttribute("name"), "check");
      assert.equal(stepOf(el, "b").querySelector(".stepper-dot").textContent.trim(), "", "no number in a vertical ring");
      assert.equal(getComputedStyle(stepOf(el, "b").querySelector(".stepper-dot")).backgroundColor, "rgba(0, 0, 0, 0)");
      assert.equal(stepOf(el, "a").querySelector(".stepper-description").textContent, "Link the account");
      assert.equal(stepOf(el, "c").querySelector(".stepper-description"), null);
    } finally {
      document.documentElement.style.removeProperty("--color-success");
    }
  });

  it("a step marked done is done whatever current says", async () => {
    const el = await mount({
      steps: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C", done: true }],
      current: "a",
    });
    assert.deepEqual(statesOf(el), ["active", "pending", "done"]);
  });
});
