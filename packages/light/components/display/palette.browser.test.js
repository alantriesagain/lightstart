import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: paletteDef } = await import("./palette.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const COLORS = ["#364f6b", "#3fc1c9", "#f5f5f5", "#fc5185"];

/** @type {Element[]} */
const mounted = [];

/**
 * @param {Record<string, string>} [attrs]
 * @param {string[]} [colors]
 */
const mount = async (attrs = {}, colors = COLORS) => {
  const el = /** @type {HTMLElement & { colors: string[], selected: boolean, interactive: boolean, $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-palette"));
  el.colors = colors;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.style.width = "160px";
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-palette", () => {
  before(async () => {
    const css = await (await fetch(new URL("./palette.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    if (!customElements.get("lc-palette")) View.define("lc-palette", paletteDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws one equal stripe per colour, in order", async () => {
    const el = await mount();
    const stripes = [...el.querySelectorAll(".stripe")];
    assert.equal(stripes.length, 4);
    assert.deepEqual(stripes.map((stripe) => getComputedStyle(stripe).backgroundColor), ["rgb(54, 79, 107)", "rgb(63, 193, 201)", "rgb(245, 245, 245)", "rgb(252, 81, 133)"]);
    const widths = stripes.map((stripe) => Math.round(stripe.getBoundingClientRect().width));
    assert.ok(widths.every((width) => width === widths[0]), `equal widths: ${widths}`);
    el.colors = ["#000000", "#ffffff"];
    await el.$requestUpdate();
    assert.equal(el.querySelectorAll(".stripe").length, 2);
  });

  it("draws the label and meta line only when one is set", async () => {
    const bare = await mount();
    assert.equal(bare.querySelector(".line"), null);
    const el = await mount({ label: "Selected", meta: "27k" });
    assert.equal(el.querySelector(".label").textContent, "Selected");
    assert.equal(el.querySelector(".meta").textContent, "27k");
  });

  it("rings the stripes while selected and drops the ring when it is not", async () => {
    const el = await mount({ selected: "" });
    const stripes = el.querySelector(".stripes");
    assert.equal(el.hasAttribute("selected"), true);
    assert.equal(getComputedStyle(stripes).outlineStyle, "solid");
    assert.equal(getComputedStyle(stripes).outlineWidth, "2px");
    assert.equal(getComputedStyle(stripes).outlineOffset, "2px");
    el.selected = false;
    await el.$requestUpdate();
    assert.equal(el.hasAttribute("selected"), false);
    assert.equal(getComputedStyle(stripes).outlineStyle, "none");
  });

  it("is a button only when interactive, and then emits select with its colours on click, Enter and Space", async () => {
    const still = await mount();
    let stray = 0;
    still.addEventListener("select", () => stray++);
    still.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(stray, 0, "a plain palette emits nothing");
    assert.equal(still.hasAttribute("role"), false);

    const el = await mount({ interactive: "", selected: "" });
    /** @type {string[][]} */
    const picked = [];
    el.addEventListener("select", (/** @type {CustomEvent<{ colors: string[] }>} */ e) => picked.push(e.detail.colors));
    assert.equal(el.getAttribute("role"), "button");
    assert.equal(el.getAttribute("tabindex"), "0");
    assert.equal(el.getAttribute("aria-pressed"), "true");
    el.querySelector(".stripe").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    assert.deepEqual(picked, [COLORS, COLORS, COLORS]);
    el.interactive = false;
    await el.$requestUpdate();
    assert.equal(el.hasAttribute("tabindex"), false, "and leaves the tab order when it stops being one");
  });
});
