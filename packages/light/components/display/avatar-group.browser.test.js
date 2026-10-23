import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: avatarDef } = await import("./avatar.js");
const { default: groupDef } = await import("./avatar-group.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {number} count @param {Record<string, string>} [attrs] */
const mount = async (count, attrs = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-avatar-group"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  for (let i = 0; i < count; i++) {
    const avatar = document.createElement("lc-avatar");
    avatar.setAttribute("name", `Person ${i}`);
    el.append(avatar);
  }
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-avatar-group", () => {
  before(async () => {
    if (!customElements.get("lc-avatar")) View.define("lc-avatar", avatarDef);
    if (!customElements.get("lc-avatar-group")) View.define("lc-avatar-group", groupDef);
    const css = (await Promise.all(["avatar", "avatar-group"].map(async (name) =>
      (await fetch(new URL(`./${name}.css`, import.meta.url))).text()))).join("\n");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    await tick();
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("overlaps its avatars and sizes them, with no tail when all fit", async () => {
    const el = await mount(3);
    const avatars = [...el.querySelectorAll("lc-avatar")];
    assert.ok(avatars.every((avatar) => avatar.getAttribute("size") === "sm"));
    assert.equal(getComputedStyle(avatars[0]).marginLeft, "0px");
    assert.equal(getComputedStyle(avatars[1]).marginLeft, "-8px");
    assert.ok(avatars.every((avatar) => getComputedStyle(avatar).display !== "none"));
    assert.equal(el.querySelector("[part~=lc-avatar-group-more]"), null);
  });

  it("hides the avatars past max and draws a +n tail", async () => {
    const el = await mount(6, { max: "4" });
    const avatars = [...el.querySelectorAll("lc-avatar")];
    assert.deepEqual(avatars.map((avatar) => getComputedStyle(avatar).display === "none"), [false, false, false, false, true, true]);
    const more = el.querySelector("[part~=lc-avatar-group-more]");
    assert.equal(more.textContent.trim(), "+2");
    assert.equal(more.getAttribute("aria-label"), "2 more");
  });

  it("follows a change of max and size", async () => {
    const el = await mount(5, { max: "4" });
    el.max = 2;
    el.size = "lg";
    await el.$requestUpdate();
    await el.$requestUpdate();
    assert.equal(el.querySelector("[part~=lc-avatar-group-more]").textContent.trim(), "+3");
    assert.ok([...el.querySelectorAll("lc-avatar")].every((avatar) => avatar.getAttribute("size") === "lg"));
  });
});
