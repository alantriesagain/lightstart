/**
 * lc-scroller keeps its internals in its sibling sheet, which the app loads
 * into the document and this suite loads itself. A track that computes as a
 * flex row is proof the sheet reached the component's own markup.
 */
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: scrollerDef } = await import("./scroller.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-scroller"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  for (let i = 0; i < 8; i++) {
    const child = document.createElement("span");
    child.textContent = `item ${i}`;
    child.style.cssText = "flex:0 0 auto;width:120px";
    el.append(child);
  }
  el.style.width = "300px";
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  const root = el;
  return {
    el,
    track: /** @type {HTMLElement} */ (root.querySelector(".track")),
    prev: /** @type {HTMLElement} */ (root.querySelector(".prev")),
    next: /** @type {HTMLElement} */ (root.querySelector(".next")),
  };
};

describe("@bootstrapp/light - lc-scroller", () => {
  before(async () => {
    View.define("lc-scroller", scrollerDef);
    const css = await (await fetch(new URL("./scroller.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("styles its own shadow internals", async () => {
    const { track } = await mount();
    const style = getComputedStyle(track);

    assert.equal(style.display, "flex", "a plain div is block; this one was reached by the component sheet");
    assert.equal(style.overflowX, "auto");
    assert.equal(style.scrollBehavior, "smooth");
  });

  it("reads the gap the host writes as a custom property", async () => {
    const { el, track } = await mount({ gap: "2rem" });
    assert.equal(el.style.getPropertyValue("--lc-scroller-gap"), "2rem", "written on the host");
    assert.equal(getComputedStyle(track).gap, "32px", "and inherited through the shadow boundary");
  });

  it("falls back to its own default when the host writes nothing", async () => {
    const { track } = await mount();
    assert.equal(getComputedStyle(track).gap, "12px", "0.75rem");
  });

  it("lets a short item keep its own height beside a tall one", async () => {
    const { el, track } = await mount();
    assert.equal(getComputedStyle(track).alignItems, "center", "a strip of chips is not stretched to its tallest");
    const [short] = /** @type {HTMLElement[]} */ ([...el.querySelectorAll("slot > span")]);
    const tall = /** @type {HTMLElement} */ (el.querySelectorAll("slot > span")[1]);
    short.style.cssText += ";height:24px";
    tall.style.cssText += ";height:72px";
    await tick();
    assert.equal(Math.round(short.getBoundingClientRect().height), 24);
  });

  it("positions the chevrons against the host", async () => {
    const { prev, next } = await mount();
    assert.equal(getComputedStyle(prev).position, "absolute");
    assert.equal(getComputedStyle(next).position, "absolute");
  });

  it("keeps both chevrons out of the way when chevrons=never", async () => {
    const { prev, next } = await mount({ chevrons: "never" });
    assert.equal(prev.hidden, true);
    assert.equal(next.hidden, true);
  });

  it("shows the forward chevron when there is more to scroll to", async () => {
    const { prev, next } = await mount({ chevrons: "always" });
    assert.equal(prev.hidden, false);
    assert.equal(next.hidden, false, "always means always, whatever the scroll position");
  });
});
