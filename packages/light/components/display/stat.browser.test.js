import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: statDef } = await import("./stat.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} attrs */
const mount = async (attrs) => {
  const el = /** @type {any} */ (document.createElement("lc-stat"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return { el, root: el };
};

describe("@bootstrapp/light - lc-stat delta", () => {
  before(async () => {
    if (!customElements.get("lc-stat")) View.define("lc-stat", statDef);
    const css = await (await fetch(new URL("./stat.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws no pill without a delta", async () => {
    const { root } = await mount({ title: "Reach", value: "48K" });
    assert.equal(root.querySelector("[part~=lc-stat-delta]"), null);
    assert.equal(root.querySelector("[part~=lc-stat-value]").textContent.trim(), "48K");
  });

  it("puts the pill after the value with an arrow by trend", async () => {
    const { root } = await mount({ title: "Reach", value: "48K", delta: "12%", trend: "up" });
    const value = root.querySelector("[part~=lc-stat-value]");
    const pill = root.querySelector("[part~=lc-stat-delta]");
    assert.equal(pill.getAttribute("part"), "lc-stat-delta lc-stat-delta-up");
    assert.equal(value.nextElementSibling, pill);
    assert.equal(pill.textContent.trim(), "12%");
    assert.equal(pill.querySelector("lc-icon").getAttribute("name"), "arrow-up-right");

    const down = (await mount({ value: "3", delta: "5%", trend: "down" })).root.querySelector("[part~=lc-stat-delta]");
    assert.equal(down.querySelector("lc-icon").getAttribute("name"), "arrow-down-right");
    assert.notEqual(getComputedStyle(pill).color, getComputedStyle(down).color, "up and down wear different colours");
  });

  it("draws a neutral pill with no arrow when flat", async () => {
    const { root } = await mount({ value: "1,024", delta: "0%" });
    const pill = root.querySelector("[part~=lc-stat-delta]");
    assert.equal(pill.getAttribute("part"), "lc-stat-delta lc-stat-delta-flat");
    assert.equal(pill.querySelector("lc-icon"), null);
    assert.equal(getComputedStyle(pill).borderTopLeftRadius, "999px");
  });
});
