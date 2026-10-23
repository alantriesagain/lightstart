import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import cardDef from "./card.js";
import containerDef from "./container.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

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

const mount = async (attrs = {}, cssText = "") => {
  const el = /** @type {any} */ (document.createElement("lc-card"));
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (cssText) el.style.cssText = cssText;
  el.append(Object.assign(document.createElement("p"), { textContent: "body" }));
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  await tick();
  return el;
};

const bodyOf = (el) => el.querySelector("[part~=lc-card-body]");

describe("@bootstrapp/light - lc-card", () => {
  before(async () => {
    if (!customElements.get("lc-container")) View.define("lc-container", containerDef);
    if (!customElements.get("lc-card")) View.define("lc-card", cardDef);
    await loadSheet(new URL("./container.css", import.meta.url).href);
    await loadSheet(new URL("./card.css", import.meta.url).href);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  after(() => { document.body.innerHTML = ""; });

  it("takes its padding steps from a host that sets them", async () => {
    const el = await mount({ padding: "lg" }, "--lc-card-lg-padding:3rem");

    assert.equal(getComputedStyle(bodyOf(el)).padding, "48px",
      "a theme sets the step; declaring the default on the element would beat it");
  });

  it("keeps its own default when no host sets one", async () => {
    const el = await mount({ padding: "xs" });

    assert.equal(getComputedStyle(bodyOf(el)).padding, "9.6px", "0.6rem, unchanged");
  });

  it("draws the border the author asked for", async () => {
    const one = await mount({});
    assert.equal(getComputedStyle(one).borderWidth, "1px", "borderWidth defaults to 1");

    const kebab = await mount({ "border-width": "none" });
    assert.equal(getComputedStyle(kebab).borderWidth, "0px", "the spelling the framework reflects");

    const authored = await mount({ borderWidth: "none" });
    assert.equal(getComputedStyle(authored).borderWidth, "0px",
      "and the spelling a template writes, which the HTML parser lowercases and nothing ever observes");
  });

  it("honours the borderWidth=\"0\" that call sites actually write", async () => {
    const el = await mount({ borderWidth: "0" });

    assert.equal(getComputedStyle(el).borderWidth, "0px");
  });

  it("draws a header row from heading and icon, with the actions slot at its end", async () => {
    const el = await mount({ heading: "Top posts", icon: "trending-up" });
    const root = el;
    const row = root.querySelector("[part~=lc-card-header-row]");
    assert.ok(row, "the row is drawn");
    assert.equal(root.querySelector('slot[name="header"]'), null, "and replaces the free-form header slot");
    const icon = row.querySelector("[part~=lc-card-icon]");
    assert.equal(getComputedStyle(icon).width, "24px");
    assert.equal(getComputedStyle(icon).borderTopLeftRadius, "6px");
    const heading = row.querySelector("[part~=lc-card-heading]");
    assert.equal(heading.textContent.trim(), "Top posts");
    assert.equal(getComputedStyle(heading).fontSize, "14px");
    assert.equal(getComputedStyle(heading).fontWeight, "600");
    assert.equal(row.lastElementChild.querySelector("slot").name, "actions");
  });

  it("keeps the header row padded and underlined when the body is flush", async () => {
    const el = await mount({ heading: "Weeks", padding: "none" });
    const row = el.querySelector("[part~=lc-card-header-row]");
    assert.equal(getComputedStyle(row).paddingBottom, "16px", "the body no longer pads under it, so the row pads itself");
    assert.equal(getComputedStyle(row).borderBottomWidth, "1px", "a hairline separates it from the flush rows");
    assert.equal(getComputedStyle(bodyOf(el)).padding, "0px");
  });

  it("keeps the free-form header slot when neither heading nor icon is set", async () => {
    const el = await mount();
    assert.ok(el.querySelector('slot[name="header"]'));
    assert.equal(el.querySelector("[part~=lc-card-header-row]"), null);
  });
});
