/**
 * The panel's detents come from its own variables: a peek written as a plain
 * length and one written as an expression land on the same stop, and the body
 * gutter counts toward what a closed panel shows.
 */
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";

const { default: panelDef } = await import("./drag-panel.js");

const tick = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/** @type {Element[]} */
const mounted = [];

/** @param {string} style */
const mount = async (style) => {
  const host = document.createElement("div");
  const el = /** @type {any} */ (document.createElement("anim-drag-panel"));
  el.setAttribute("detent", "closed");
  el.style.cssText = style;
  const handle = document.createElement("div");
  handle.setAttribute("data-drag-handle", "");
  handle.style.height = "24px";
  const body = document.createElement("div");
  body.setAttribute("data-drag-body", "");
  body.textContent = "content";
  el.append(handle, body);
  host.append(el);
  document.body.append(host);
  mounted.push(host);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

/** @param {any} el */
const visible = (el) => Math.round(window.innerHeight - el.getBoundingClientRect().top);

describe("@lightstart/light - anim-drag-panel detents", () => {
  before(() => {
    if (!customElements.get("anim-drag-panel")) View.define("anim-drag-panel", panelDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./drag-panel.css", import.meta.url).href;
    document.head.append(sheet);
    return new Promise((resolve) => { sheet.onload = () => resolve(undefined); sheet.onerror = () => resolve(undefined); });
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("a closed panel shows its peek plus its gutter", async () => {
    const el = await mount("--anim-drag-panel-peek:60px;--anim-drag-panel-gutter:20px");
    assert.equal(visible(el), 80);
  });

  it("a peek written as an expression measures the same", async () => {
    const el = await mount("--anim-drag-panel-peek:calc(20px + 60px + 40px);--anim-drag-panel-gutter:max(20px, 0.5rem)");
    assert.equal(visible(el), 140);
  });
});
