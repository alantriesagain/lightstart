import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import joinDef from "./join.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const loadSheet = (href) => new Promise((resolve) => {
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = href;
  sheet.onload = resolve;
  sheet.onerror = resolve;
  document.head.append(sheet);
});

/** @type {Element[]} */
const mounted = [];

const mount = async (cssText = "") => {
  const join = document.createElement("lc-join");
  join.style.cssText = `position:fixed;left:20px;top:20px;width:200px;height:40px;${cssText}`;
  const pane = document.createElement("div");
  pane.style.cssText = "position:relative;width:100%;height:100%";
  const pop = document.createElement("div");
  pop.dataset.pop = "";
  pop.style.cssText = "position:absolute;left:0;top:100%;width:100%;height:60px;background:rgb(10, 20, 30)";
  pane.append(pop);
  join.append(pane);
  document.body.append(join);
  mounted.push(join);
  await tick();
  return { join, pop };
};

/** @param {Element} el */
const hitsItself = (el) => {
  const box = el.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return el.contains(hit);
};

describe("@bootstrapp/light - lc-join", () => {
  before(async () => {
    if (!customElements.get("lc-join")) View.define("lc-join", joinDef);
    await loadSheet(new URL("./join.css", import.meta.url).href);
  });

  after(() => {
    for (const el of mounted.splice(0)) el.remove();
  });

  it("clips a child that reaches past its edge, as it always has", async () => {
    const { pop } = await mount();

    assert.ok(pop.getBoundingClientRect().height > 0, "the popover has a layout box either way");
    assert.equal(hitsItself(pop), false, "the default join clips what hangs below it");
  });

  it("lets the popover through once the consumer asks for it", async () => {
    const { pop } = await mount("--lc-join-overflow:visible");

    assert.equal(hitsItself(pop), true, "a select's menu or a search's results can escape the pill");
  });

  it("paints a pill from the variables rather than an inline override", async () => {
    const { join } = await mount(
      "--lc-join-border-radius:9999px;--lc-join-background:rgb(255, 0, 0);--lc-join-shadow:0px 2px 8px rgb(0, 0, 0)",
    );
    const style = getComputedStyle(join);

    assert.equal(style.borderRadius, "9999px");
    assert.equal(style.backgroundColor, "rgb(255, 0, 0)");
    assert.equal(style.boxShadow, "rgb(0, 0, 0) 0px 2px 8px 0px");
  });

  it("takes its look from a variable set anywhere above it", async () => {
    const host = document.createElement("div");
    host.style.cssText = "--lc-join-background:rgb(0, 0, 255);--lc-join-border-radius:9999px";
    const join = document.createElement("lc-join");
    join.append(document.createElement("div"));
    host.append(join);
    document.body.append(host);
    mounted.push(host);
    await tick();
    const style = getComputedStyle(join);

    assert.equal(style.backgroundColor, "rgb(0, 0, 255)", "a component rendering the join can style it from its own host");
    assert.equal(style.borderRadius, "9999px");
  });

  it("colours the seam between panes on its own variable", async () => {
    const join = document.createElement("lc-join");
    join.style.cssText = "--lc-join-divider-color:rgb(0, 128, 0)";
    const first = document.createElement("div");
    const second = document.createElement("div");
    join.append(first, second);
    document.body.append(join);
    mounted.push(join);
    await tick();

    assert.equal(getComputedStyle(second).borderLeftColor, "rgb(0, 128, 0)");
    assert.equal(getComputedStyle(first).borderLeftStyle, "none", "only the seam is drawn, not the leading edge");
  });
});
