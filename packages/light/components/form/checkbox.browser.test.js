import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: checkboxDef } = await import("./checkbox.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {string} url */
const loadSheet = (url) => new Promise((resolve, reject) => {
  if (document.querySelector(`link[href="${url}"]`)) return resolve(undefined);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.onload = () => resolve(undefined);
  link.onerror = reject;
  document.head.append(link);
});

/** @param {Record<string, string>} [attrs] */
const TOKENS = "--color-surface: rgb(255, 255, 255); --color-success: rgb(30, 123, 59); --color-warning: rgb(138, 90, 0); --border-color: rgb(200, 200, 200)";

const mount = async (attrs = {}) => {
  const el = /** @type {HTMLElement & { checked: boolean, indeterminate: boolean, $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-checkbox"));
  el.setAttribute("style", TOKENS);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {Element} el */
const box = (el) => /** @type {HTMLInputElement} */ (el.querySelector("input.checkbox"));

describe("@bootstrapp/light - lc-checkbox", () => {
  before(async () => {
    if (!customElements.get("lc-checkbox")) View.define("lc-checkbox", checkboxDef);
    await loadSheet(new URL("./checkbox.css", import.meta.url).href);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("reports a change with its checked state and clears indeterminate", async () => {
    const el = await mount({ indeterminate: "" });
    /** @type {Array<{ checked: boolean }>} */
    const seen = [];
    el.addEventListener("change", (e) => seen.push(/** @type {CustomEvent<{ checked: boolean }>} */ (e).detail));
    assert.equal(box(el).indeterminate, true);
    box(el).click();
    await el.$requestUpdate();
    assert.equal(el.checked, true);
    assert.equal(el.indeterminate, false);
    assert.deepEqual(seen.map((d) => d.checked), [true]);
  });

  it("draws round as a ring, with a dot for indeterminate and a check when checked", async () => {
    const ring = await mount({ shape: "round", size: "sm" });
    assert.equal(getComputedStyle(box(ring)).borderRadius, "50%");
    assert.equal(getComputedStyle(box(ring)).width, "20px");
    const doing = await mount({ shape: "round", variant: "warning", indeterminate: "" });
    const dot = getComputedStyle(box(doing), "::after");
    assert.equal(dot.borderRadius, "50%", "the indeterminate mark is a dot");
    assert.equal(getComputedStyle(box(doing)).backgroundColor, getComputedStyle(box(ring)).backgroundColor, "the ring stays open around the dot");
    const done = await mount({ shape: "round", variant: "success", checked: "" });
    assert.notEqual(getComputedStyle(box(done)).backgroundColor, getComputedStyle(box(ring)).backgroundColor, "checked fills the ring");
  });
});
