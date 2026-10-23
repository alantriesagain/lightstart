import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: mediaCardDef } = await import("./media-card.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, string>} attrs @param {string} [inner] */
const mount = async (attrs, inner = "") => {
  const el = /** @type {any} */ (document.createElement("lc-media-card"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.innerHTML = inner;
  el.style.width = "200px";
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  await tick();
  await el.$requestUpdate();
  return { el, root: el };
};

describe("@bootstrapp/light - lc-media-card", () => {
  before(async () => {
    const css = await (await fetch(new URL("./media-card.css", import.meta.url))).text();
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    if (!customElements.get("lc-media-card")) View.define("lc-media-card", mediaCardDef);
    document.documentElement.style.setProperty("--radius-box", "14px");
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  after(() => document.documentElement.style.removeProperty("--radius-box"));

  it("draws the image at the 4/5 aspect by default, rounded by the box role, with a scrim", async () => {
    const { root } = await mount({ src: PIXEL, alt: "A photo" });
    const media = root.querySelector("[part~=lc-media-card-media]");
    const box = media.getBoundingClientRect();
    assert.equal(box.width, 200);
    assert.equal(box.height, 250);
    assert.equal(getComputedStyle(media).borderTopLeftRadius, "14px");
    assert.equal(root.querySelector("[part~=lc-media-card-image]").getAttribute("alt"), "A photo");
    assert.ok(root.querySelector("[part~=lc-media-card-scrim]"));
  });

  it("follows another aspect and drops the scrim when asked", async () => {
    const { el, root } = await mount({ src: PIXEL, aspect: "1/1" });
    el.scrim = false;
    await el.$requestUpdate();
    const box = root.querySelector("[part~=lc-media-card-media]").getBoundingClientRect();
    assert.equal(box.height, box.width);
    assert.equal(root.querySelector("[part~=lc-media-card-scrim]"), null);
  });

  it("pins top to the top-left, bottom over the image's foot, and meta under the image", async () => {
    const { root } = await mount(
      { src: PIXEL },
      '<span slot="top" id="badge">Reel</span><strong slot="bottom" id="title">Title</strong><span id="meta">3 days ago</span>',
    );
    const media = root.querySelector("[part~=lc-media-card-media]").getBoundingClientRect();
    const badge = document.getElementById("badge").getBoundingClientRect();
    const title = document.getElementById("title").getBoundingClientRect();
    const meta = document.getElementById("meta").getBoundingClientRect();
    assert.ok(badge.top - media.top < 20 && badge.left - media.left < 20, "the badge sits in the top-left corner");
    assert.ok(media.bottom - title.bottom < 20 && title.top > media.top + media.height / 2, "the title sits at the foot");
    assert.ok(meta.top >= media.bottom, "the meta sits under the image");
    assert.equal(root.querySelector("[part~=lc-media-card-body]").hidden, false);
  });

  it("collapses the space under the image when nothing is slotted there", async () => {
    const { root } = await mount({ src: PIXEL }, '<span slot="top">Reel</span>');
    assert.equal(root.querySelector("[part~=lc-media-card-body]").hidden, true);
  });
});
