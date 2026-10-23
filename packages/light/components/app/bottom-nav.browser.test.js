/**
 * The pill variant lays its children out as round items. A `wide` child keeps
 * its own width, a `prominent` child takes the larger size, and the pill's
 * width and alignment follow their variables, so an app can spread a search
 * button, a segmented switch and an action across the bar.
 */
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: barDef } = await import("./bottom-nav.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {string} [style] */
const mount = async (style = "") => {
  const el = /** @type {any} */ (document.createElement("lc-bottom-nav"));
  el.setAttribute("variant", "pill");
  el.style.cssText = style;
  const search = document.createElement("button");
  search.textContent = "S";
  const wide = document.createElement("div");
  wide.setAttribute("wide", "");
  const inner = document.createElement("span");
  inner.style.cssText = "display:inline-block;width:90px;height:20px";
  const inner2 = document.createElement("span");
  inner2.style.cssText = "display:inline-block;width:90px;height:20px";
  wide.append(inner, inner2);
  const plus = document.createElement("button");
  plus.setAttribute("prominent", "");
  plus.textContent = "+";
  el.append(search, wide, plus);
  const host = document.createElement("div");
  host.style.width = "390px";
  host.append(el);
  document.body.append(host);
  mounted.push(host);
  await tick();
  await el.$requestUpdate();
  return { el, search, wide, plus };
};

describe("@bootstrapp/light - lc-bottom-nav pill", () => {
  before(() => {
    if (!customElements.get("lc-bottom-nav")) View.define("lc-bottom-nav", barDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./bottom-nav.css", import.meta.url).href;
    document.head.append(sheet);
    return new Promise((resolve) => { sheet.onload = () => resolve(undefined); sheet.onerror = () => resolve(undefined); });
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("round items take the item size, a wide child keeps its own width, prominent grows", async () => {
    const { search, wide, plus } = await mount();
    assert.equal(getComputedStyle(search).width, "44px", "a plain child is one round item");
    assert.ok(wide.getBoundingClientRect().width >= 180, "a wide child wraps its content");
    assert.equal(getComputedStyle(plus).width, "48px", "the prominent child takes the larger size");
  });

  it("a wide child lays its own children out in a row", async () => {
    const { wide } = await mount();
    const [one, two] = [...wide.children].map((c) => c.getBoundingClientRect());
    assert.ok(two.left >= one.right - 1, `the second child sits beside the first (${one.right} then ${two.left})`);
    assert.equal(Math.round(one.top), Math.round(two.top), "both on one line");
  });

  it("the pill can span its container and spread its items", async () => {
    const { el, search, plus } = await mount("--lc-bottom-nav-width:100%;--lc-bottom-nav-justify:space-between");
    assert.equal(Math.round(el.getBoundingClientRect().width), 390);
    const gap = plus.getBoundingClientRect().left - search.getBoundingClientRect().right;
    assert.ok(gap > 200, `items spread across the bar (gap ${gap})`);
  });
});

/** @param {Record<string, string>} marks @param {string} [style] @param {string[]} [names] @param {string} [width] */
const mountDock = async (marks = {}, style = "", names = ["today", "map", "saved"], width = "390px") => {
  const el = /** @type {any} */ (document.createElement("lc-bottom-nav"));
  el.setAttribute("variant", "dock");
  el.style.cssText = style;
  const items = names.map((name) => {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = name;
    if (marks[name] !== undefined) item.setAttribute(marks[name], "");
    return item;
  });
  el.append(...items);
  const host = document.createElement("div");
  host.style.width = width;
  host.append(el);
  document.body.append(host);
  mounted.push(host);
  await tick();
  await el.$requestUpdate();
  return { el, items };
};

describe("@bootstrapp/light - lc-bottom-nav dock", () => {
  before(() => {
    if (!customElements.get("lc-bottom-nav")) View.define("lc-bottom-nav", barDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("is one pill of a fixed height whose items are round by default", async () => {
    const { el, items } = await mountDock();
    assert.equal(getComputedStyle(el).height, "64px");
    assert.equal(getComputedStyle(el).borderRadius, "9999px");
    for (const item of items) assert.equal(getComputedStyle(item).width, "52px", "a plain child is one round item");
  });

  it("the active item widens to show its label, the others stay round", async () => {
    const { items } = await mountDock({ today: "active" });
    const [today, map] = items.map((item) => item.getBoundingClientRect().width);
    assert.ok(today > map, `the active item (${today}) is wider than a round one (${map})`);
    assert.equal(Math.round(map), 52);
  });

  it("a primary child takes the room the collapsed ones leave, so the bar becomes one action", async () => {
    const { el, items } = await mountDock({ today: "collapsed", map: "primary", saved: "collapsed" });
    const [today, map, saved] = items.map((item) => item.getBoundingClientRect().width);
    assert.equal(today, 0, "a collapsed child has no width");
    assert.equal(saved, 0);
    assert.ok(map > 52 * 2, `the primary child grows into the pill (${map})`);
    assert.equal(getComputedStyle(items[0]).pointerEvents, "none", "and nothing collapsed can be tapped");
    assert.equal(getComputedStyle(el).height, "64px", "the height does not move between the two states");
  });

  it("with item-grow on, the idle items share the room, so an active item at either end sits against the padding", async () => {
    const grow = "--lc-bottom-nav-item-grow:1;--lc-bottom-nav-dock-padding:6px";
    const first = await mountDock({ today: "active" }, grow);
    const bar = first.el.getBoundingClientRect();
    assert.equal(Math.round(first.items[0].getBoundingClientRect().left - bar.left), 6, "the first, active, against the left padding");
    assert.equal(Math.round(bar.right - first.items[2].getBoundingClientRect().right), 6, "and the row fills to the right one");
    assert.ok(first.items[1].getBoundingClientRect().width > 52, "the idle ones grew");
    const last = await mountDock({ saved: "active" }, grow);
    const edge = last.el.getBoundingClientRect();
    assert.equal(Math.round(edge.right - last.items[2].getBoundingClientRect().right), 6, "the last, active, against the right padding");
    const off = await mountDock({ today: "active" });
    assert.ok(off.items[0].getBoundingClientRect().left - off.el.getBoundingClientRect().left > 6, "without it the row stays centred");
  });

  it("with a floor set, the idle items give way to a long active label rather than leave the bar", async () => {
    const names = ["today", "inbox", "map", "saved", "you"];
    const marks = { today: "active" };
    const style = "--lc-bottom-nav-item-grow:1;--lc-bottom-nav-dock-padding:6px;--lc-bottom-nav-item-min-width:36px";
    const { el, items } = await mountDock(marks, style, names, "320px");
    items[0].textContent = "This week in Rio de Janeiro";
    await tick();
    const bar = el.getBoundingClientRect();
    assert.ok(items[0].getBoundingClientRect().left >= bar.left + 5, "the first stays inside the padding");
    assert.ok(items[4].getBoundingClientRect().right <= bar.right - 5, "and so does the last");
    for (const item of items.slice(1)) assert.ok(item.getBoundingClientRect().width >= 36 - 0.5, `an idle item keeps its floor: ${item.getBoundingClientRect().width}`);
    const fixed = await mountDock(marks, "", names);
    assert.equal(Math.round(fixed.items[1].getBoundingClientRect().width), 52, "with no floor set, an idle item keeps the item size");
  });

  it("with item-grow on, the bar's one action still takes the room", async () => {
    const { items } = await mountDock({ today: "collapsed", map: "primary", saved: "wide" }, "--lc-bottom-nav-item-grow:1");
    const [map, saved] = [items[1], items[2]].map((item) => item.getBoundingClientRect().width);
    assert.ok(map > saved, `the action (${map}) is not shared with what rides beside it (${saved})`);
  });

  it("morphs rather than swaps: the sizes transition on the same nodes", async () => {
    const { items } = await mountDock({ map: "primary" });
    const transition = getComputedStyle(items[1]).transitionProperty;
    for (const property of ["flex-grow", "width", "opacity"]) assert.ok(transition.includes(property), `${property} transitions`);
  });
});
