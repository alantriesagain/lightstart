import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: avatarDef } = await import("./avatar.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** @param {() => unknown} fn */
const until = async (fn, ms = 3000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return true;
    await tick();
  }
  return false;
};

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} [attrs] */
const mount = async (attrs = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-avatar"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-avatar", () => {
  before(() => {
    if (!customElements.get("lc-avatar")) View.define("lc-avatar", avatarDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws the user glyph with nothing to go on, and the icon it is given instead", async () => {
    const plain = await mount();
    assert.equal(plain.querySelector("lc-icon")?.getAttribute("name"), "user");
    const place = await mount({ icon: "map-pin", shape: "rounded" });
    assert.equal(place.querySelector("lc-icon")?.getAttribute("name"), "map-pin");
    assert.equal(place.querySelector("img"), null);
  });

  it("initials win over the icon, and the image over both", async () => {
    const named = await mount({ name: "Ana Lima", icon: "map-pin" });
    assert.equal(named.querySelector(".initials")?.textContent, "AL");
    assert.equal(named.querySelector("lc-icon"), null);
    const pictured = await mount({ name: "Ana Lima", src: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" });
    assert.ok(pictured.querySelector("img"));
    assert.equal(pictured.querySelector(".initials"), null);
  });

  it("an image that fails to load falls back to the initials, and a new source is tried again", async () => {
    const el = await mount({ name: "Ana Lima", src: "/lc-avatar-missing-" + Date.now() + ".png" });
    assert.ok(el.querySelector("img"), "the image is tried first");
    assert.ok(await until(() => el.querySelector(".initials")), "the broken image gives way to the initials");
    assert.equal(el.querySelector("img"), null);
    el.setAttribute("src", "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==");
    await el.$requestUpdate();
    assert.ok(el.querySelector("img"), "a new source starts over");
  });
});
