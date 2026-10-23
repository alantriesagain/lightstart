import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: tileDef } = await import("./tile.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-tile"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-tile", () => {
  before(async () => {
    const css = await (await fetch(new URL("./tile.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    if (!customElements.get("lc-tile")) View.define("lc-tile", tileDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws the image, the badge, the label and the meta at the asked aspect", async () => {
    const el = await mount({ src: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", label: "lisbon-night.jpg", meta: "4:5 · 2.1 MB", badge: "JPG", aspect: "4/5" });
    const root = el;
    assert.equal(root.querySelector("img")?.getAttribute("src")?.startsWith("data:image/gif"), true);
    assert.equal(root.querySelector(".badge")?.textContent?.trim(), "JPG");
    assert.equal(root.querySelector(".label")?.textContent?.trim(), "lisbon-night.jpg");
    assert.equal(root.querySelector(".meta")?.textContent?.trim(), "4:5 · 2.1 MB");
    assert.equal(getComputedStyle(root.querySelector(".media")).aspectRatio.replace(/\s/g, ""), "4/5");
  });

  it("is a button only when interactive, and then emits select on click and on Enter", async () => {
    const el = await mount({ label: "Quote card", interactive: "" });
    /** @type {number} */
    let selected = 0;
    el.addEventListener("select", () => selected++);
    assert.equal(el.getAttribute("role"), "button");
    assert.equal(el.getAttribute("tabindex"), "0");
    el.querySelector(".media").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    el.querySelector(".media").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    el.querySelector(".media").dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    assert.equal(selected, 2);
    el.setAttribute("disabled", "");
    await el.$requestUpdate();
    el.querySelector(".media").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(selected, 2, "a disabled tile emits nothing");
    assert.equal(el.hasAttribute("tabindex"), false, "and leaves the tab order");
  });

  it("shimmers while loading and shows the icon when there is no image", async () => {
    const el = await mount({ icon: "music", label: "song.mp3", loading: "" });
    assert.ok(el.querySelector(".shimmer"));
    el.removeAttribute("loading");
    await el.$requestUpdate();
    assert.equal(el.querySelector(".shimmer"), null);
    assert.equal(el.querySelector("lc-icon")?.getAttribute("name"), "music");
  });
});
