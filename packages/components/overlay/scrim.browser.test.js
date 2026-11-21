import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";

const { default: scrimDef } = await import("./scrim.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const escape = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {HTMLElement & { open: boolean, $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-scrim"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@lightstart/light - lc-scrim", () => {
  before(async () => {
    const css = await (await fetch(new URL("./scrim.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    if (!customElements.get("lc-scrim")) View.define("lc-scrim", scrimDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("is inert until it is open", async () => {
    const el = await mount();
    assert.equal(el.open, false);
    assert.equal(getComputedStyle(el).pointerEvents, "none");

    el.open = true;
    await el.$requestUpdate();
    assert.equal(el.hasAttribute("open"), true);
    assert.equal(getComputedStyle(el).pointerEvents, "auto");
  });

  it("reports a click as a dismissal without closing itself", async () => {
    const el = await mount({ open: "" });
    let dismissed = 0;
    el.addEventListener("dismiss", () => dismissed++);

    el.click();
    assert.equal(dismissed, 1);
    assert.equal(el.open, true, "the owner decides whether it closes");
  });

  it("reports Escape as a dismissal", async () => {
    const el = await mount({ open: "" });
    let dismissed = 0;
    el.addEventListener("dismiss", () => dismissed++);

    escape();
    assert.equal(dismissed, 1);
    assert.equal(el.open, true);
  });

  it("keeps both to itself when it is not dismissible", async () => {
    const el = await mount({ open: "", "dismissible": "false" });
    let dismissed = 0;
    el.addEventListener("dismiss", () => dismissed++);

    el.click();
    escape();
    assert.equal(dismissed, 0);
  });
});
