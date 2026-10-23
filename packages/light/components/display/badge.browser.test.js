import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: badgeDef } = await import("./badge.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The sibling sheet the way the app gets it: in the document for a light-DOM
 * element, and in the one shared sheet every shadow root adopts.
 * @param {string[]} names
 */
const loadStyles = async (...names) => {
  const css = (await Promise.all(names.map(async (name) =>
    (await fetch(new URL(`./${name}.css`, import.meta.url))).text()))).join("\n");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  await tick();
};

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] @param {string} [text] */
const mount = async (attrs = {}, text = "") => {
  const el = /** @type {any} */ (document.createElement("lc-badge"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.textContent = text;
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

const px = (/** @type {Element} */ el, /** @type {string} */ prop) => Number.parseFloat(getComputedStyle(el)[prop]);

describe("@bootstrapp/light - lc-badge", () => {
  before(async () => {
    if (!customElements.get("lc-badge")) View.define("lc-badge", badgeDef);
    await loadStyles("badge");
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws a count as text at the size it was given", async () => {
    const el = await mount({ variant: "danger", size: "sm" }, "5");
    assert.equal(el.textContent, "5");
    assert.ok(px(el, "fontSize") > 0, "a badge with a number in it has type");
  });

  it("a dot is round, has no type and keeps none of the padding a size sets", async () => {
    const el = await mount({ dot: "", size: "lg" });
    assert.equal(px(el, "paddingLeft"), 0, "the size block sets padding, and dot comes after it");
    assert.equal(px(el, "paddingTop"), 0);
    assert.equal(px(el, "fontSize"), 0);
    assert.equal(px(el, "width"), px(el, "height"), "round means square first");
    assert.ok(px(el, "width") > 0 && px(el, "width") < 16);
  });

  it("corner takes it out of the flow, so a host marks itself by going relative", async () => {
    const plain = await mount({ dot: "" });
    assert.equal(getComputedStyle(plain).position, "static");

    const el = await mount({ dot: "", corner: "" });
    assert.equal(getComputedStyle(el).position, "absolute");
    assert.notEqual(getComputedStyle(el).boxShadow, "none", "and carries a ring, so it reads against whatever is under it");
  });

  it("place moves a corner badge to another corner of its host", async () => {
    const host = document.createElement("div");
    host.style.cssText = "position:relative;width:40px;height:40px";
    const el = /** @type {any} */ (document.createElement("lc-badge"));
    el.setAttribute("dot", "");
    el.setAttribute("corner", "");
    el.setAttribute("place", "bottom-left");
    host.append(el);
    document.body.append(host);
    mounted.push(host);
    await tick();
    await el.$requestUpdate();
    const box = el.getBoundingClientRect();
    const around = host.getBoundingClientRect();
    assert.ok(box.bottom > around.bottom - 6, "it hangs off the bottom edge");
    assert.ok(box.left < around.left + 6, "and the left one");
  });

  it("secondary is the app's second colour, the same idea as primary", async () => {
    document.documentElement.style.setProperty("--color-secondary", "rgb(1, 2, 3)");
    try {
      const el = await mount({ secondary: "" }, "new");
      assert.equal(getComputedStyle(el).backgroundColor, "rgb(1, 2, 3)");
    } finally {
      document.documentElement.style.removeProperty("--color-secondary");
    }
  });

  it("an explicit background wins over the variant, which is what a host restyling a dot sets", async () => {
    const el = await mount({ dot: "", primary: "" });
    el.style.setProperty("--lc-badge-background", "rgb(9, 9, 9)");
    await el.$requestUpdate();
    assert.equal(getComputedStyle(el).backgroundColor, "rgb(9, 9, 9)");
  });

  it("the dot colour paints a bare dot over its variant, as it paints the dot beside a label", async () => {
    const el = await mount({ dot: "", primary: "" });
    el.style.setProperty("--lc-badge-primary-background", "rgb(31, 26, 23)");
    el.style.setProperty("--lc-badge-dot-color", "rgb(250, 92, 92)");
    await el.$requestUpdate();
    assert.equal(getComputedStyle(el).backgroundColor, "rgb(250, 92, 92)", "a theme whose primary is dark still gets the dot it asked for");
  });

  it("a dot on a badge with a label draws a dot before the text and keeps the padding", async () => {
    const el = await mount({ dot: "", soft: "", variant: "success" }, "Live");
    assert.ok(px(el, "paddingLeft") > 0, "a labelled badge is not collapsed into a dot");
    assert.ok(px(el, "fontSize") > 0);
    const before = getComputedStyle(el, "::before");
    assert.equal(before.width, "6px");
    assert.equal(before.height, "6px");
  });

  it("soft tints the default and primary variants instead of filling them", async () => {
    document.documentElement.style.setProperty("--color-primary", "rgb(0, 0, 255)");
    try {
      const filled = await mount({ variant: "primary" }, "On");
      const soft = await mount({ variant: "primary", soft: "" }, "On");
      assert.equal(getComputedStyle(filled).backgroundColor, "rgb(0, 0, 255)");
      assert.notEqual(getComputedStyle(soft).backgroundColor, "rgb(0, 0, 255)");
      assert.equal(getComputedStyle(soft).color, "rgb(0, 0, 255)");
      const plain = await mount({ soft: "" }, "Draft");
      assert.notEqual(getComputedStyle(plain).backgroundColor, "rgba(0, 0, 0, 0)");
    } finally {
      document.documentElement.style.removeProperty("--color-primary");
    }
  });
});
