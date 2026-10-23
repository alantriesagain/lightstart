import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: circleDef } = await import("./story-circle.js");
const { default: avatarDef } = await import("./avatar.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @param {string[]} names */
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

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-story-circle"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

describe("@bootstrapp/light - lc-story-circle", () => {
  before(async () => {
    if (!customElements.get("lc-avatar")) View.define("lc-avatar", avatarDef);
    if (!customElements.get("lc-story-circle")) View.define("lc-story-circle", circleDef);
    await loadStyles("avatar", "story-circle");
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws the avatar ringed in the state's colour, with the name under it", async () => {
    const el = await mount({ name: "Martina Klein", ring: "primary", sub: "Ipanema" });
    const avatar = el.querySelector("lc-avatar");
    assert.ok(avatar, "the circle is an avatar");
    assert.equal(avatar.getAttribute("ring"), "primary");
    assert.equal(el.querySelector(".story-circle-label")?.textContent, "Martina Klein", "the name is the label when none is given");
    assert.equal(el.querySelector(".story-circle-sub")?.textContent, "Ipanema");
  });

  it("masks a person: a question mark on a plain fill, the badge and the lines kept", async () => {
    const el = await mount({ name: "Martina Klein", label: "Beach", sub: "Ipanema", "badge-icon": "umbrella", ring: "muted", masked: "" });
    for (let i = 0; i < 40 && !el.querySelector("lc-avatar .initials"); i++) await tick();
    assert.equal(el.querySelector("lc-avatar .initials")?.textContent, "?", "who it is stays hidden");
    assert.equal(el.querySelector(".story-circle-label")?.textContent, "Beach");
    assert.equal(el.querySelector(".story-circle-sub")?.textContent, "Ipanema");
    assert.ok(el.querySelector(".story-circle-badge lc-icon"), "the activity still shows");
    assert.equal(getComputedStyle(el.querySelector(".story-circle-media")).outlineStyle, "dashed");
  });

  it("carries a badge with an icon or a text, and none when neither is given", async () => {
    const icon = await mount({ name: "Tom", "badge-icon": "beer" });
    assert.ok(icon.querySelector(".story-circle-badge lc-icon"));
    const text = await mount({ name: "Arpoador", "badge-text": "6" });
    assert.equal(text.querySelector(".story-circle-badge")?.textContent?.trim(), "6");
    const bare = await mount({ name: "Ana" });
    assert.equal(bare.querySelector(".story-circle-badge"), null);
  });

  it("tells the page it was picked", async () => {
    const el = await mount({ name: "Martina" });
    /** @type {unknown[]} */
    const picks = [];
    el.addEventListener("select", (/** @type {Event} */ e) => picks.push(/** @type {CustomEvent} */ (e).detail));
    el.querySelector(".story-circle-hit").click();
    assert.deepEqual(picks, [{ href: "" }]);
    assert.equal(el.querySelector(".story-circle-hit")?.localName, "button", "with no href it is a button");
  });

  it("is a link when given somewhere to go", async () => {
    const el = await mount({ name: "Martina", href: "/people/abc" });
    assert.equal(el.querySelector("a.story-circle-hit")?.getAttribute("href"), "/people/abc");
  });

  it("grows with size and keeps one column", async () => {
    const md = await mount({ name: "A" });
    const lg = await mount({ name: "B", size: "lg" });
    assert.ok(lg.getBoundingClientRect().width > md.getBoundingClientRect().width);
    assert.ok(lg.querySelector("lc-avatar").getBoundingClientRect().width > md.querySelector("lc-avatar").getBoundingClientRect().width);
  });
});
