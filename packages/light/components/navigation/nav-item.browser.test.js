import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import navItemDef from "./nav-item.js";

const waitFor = async (predicate, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe("lc-nav-item icon-only", () => {
  let el;

  before(async () => {
    if (!customElements.get("lc-nav-item")) View.define("lc-nav-item", navItemDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./nav-item.css", import.meta.url).href;
    const loaded = new Promise((resolve) => { sheet.onload = resolve; sheet.onerror = resolve; });
    document.head.append(sheet);
    await loaded;
    el = document.createElement("lc-nav-item");
    el.setAttribute("icon-only", "");
    el.setAttribute("icon", "house");
    el.setAttribute("label", "Home");
    el.style.cssText = "width:48px;height:48px";
    document.body.appendChild(el);
  });

  after(() => el.remove());

  it("centres its glyph whichever way the attribute is spelled", async () => {
    await waitFor(() => el.querySelector("lc-icon"), "icon");
    assert.equal(getComputedStyle(el).justifyContent, "center", "the framework's kebab attribute centres too");
    el.removeAttribute("icon-only");
    el.setAttribute("iconOnly", "");
    assert.equal(getComputedStyle(el).justifyContent, "center", "and so does the camel spelling");
  });
});

describe("lc-nav-item stacked", () => {
  let el;

  before(async () => {
    if (!customElements.get("lc-nav-item")) View.define("lc-nav-item", navItemDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./nav-item.css", import.meta.url).href;
    const loaded = new Promise((resolve) => { sheet.onload = resolve; sheet.onerror = resolve; });
    document.head.append(sheet);
    await loaded;
    el = document.createElement("lc-nav-item");
    el.setAttribute("stacked", "");
    el.setAttribute("icon", "house");
    el.setAttribute("label", "Home");
    el.setAttribute("badge", "2");
    document.body.appendChild(el);
  });

  after(() => el.remove());

  it("puts the icon above the label and keeps the badge", async () => {
    await waitFor(() => el.querySelector(".nav-item-label"), "label");
    const label = el.querySelector(".nav-item-label");
    assert.equal(getComputedStyle(label).flexDirection, "column");
    assert.ok(label.querySelector("lc-icon"), "the icon sits inside the label");
    assert.equal(label.textContent.trim(), "Home");
    assert.equal(el.querySelector(".nav-item-badge").textContent.trim(), "2");
    assert.equal(el.querySelector("button").getAttribute("title"), "", "a stacked item shows its label, so it needs no title");
  });
});

describe("lc-nav-item badge variants", () => {
  /** @type {any[]} */
  const els = [];

  before(async () => {
    if (!customElements.get("lc-nav-item")) View.define("lc-nav-item", navItemDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./nav-item.css", import.meta.url).href;
    const loaded = new Promise((resolve) => { sheet.onload = resolve; sheet.onerror = resolve; });
    document.head.append(sheet);
    await loaded;
    document.documentElement.style.setProperty("--color-primary", "rgb(0, 0, 200)");
    for (const variant of ["default", "primary", "muted"]) {
      const el = document.createElement("lc-nav-item");
      el.setAttribute("label", variant);
      el.setAttribute("badge", "7");
      if (variant !== "default") el.setAttribute("badge-variant", variant);
      document.body.appendChild(el);
      els.push(el);
    }
  });

  after(() => {
    for (const el of els) el.remove();
    document.documentElement.style.removeProperty("--color-primary");
  });

  it("reflects the variant and styles the badge by it", async () => {
    await waitFor(() => els.every((el) => el.querySelector(".nav-item-badge")), "badges");
    const [plain, primary, muted] = els.map((el) => el.querySelector(".nav-item-badge"));
    assert.equal(els[0].getAttribute("badge-variant"), "default");
    assert.equal(getComputedStyle(primary).backgroundColor, "rgb(0, 0, 200)");
    assert.equal(getComputedStyle(primary).borderTopLeftRadius, "999px");
    assert.equal(getComputedStyle(muted).backgroundColor, "rgba(0, 0, 0, 0)");
    assert.notEqual(getComputedStyle(plain).backgroundColor, "rgb(0, 0, 200)");
  });
});

describe("lc-nav-item count", () => {
  /** @type {HTMLElement[]} */
  const els = [];

  before(async () => {
    if (!customElements.get("lc-nav-item")) View.define("lc-nav-item", navItemDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./nav-item.css", import.meta.url).href;
    const loaded = new Promise((resolve) => { sheet.onload = resolve; sheet.onerror = resolve; });
    document.head.append(sheet);
    await loaded;
    for (const active of [false, true]) {
      const el = document.createElement("lc-nav-item");
      el.setAttribute("icon", "inbox");
      el.setAttribute("label", "Inbox");
      el.setAttribute("count", "3");
      if (active) el.setAttribute("active", "");
      else el.setAttribute("icon-only", "");
      el.setAttribute("active-bg", "");
      el.style.cssText = "--lc-nav-item-active-background:rgb(251, 239, 118);--lc-nav-item-count-ring-color:rgb(31, 26, 23)";
      document.body.appendChild(el);
      els.push(el);
    }
  });

  after(() => {
    for (const el of els) el.remove();
  });

  it("rides the icon's corner whether the item says its label or not", async () => {
    await waitFor(() => els.every((el) => el.querySelector(".nav-item-count")), "counts");
    for (const el of els) {
      const count = el.querySelector(".nav-item-count");
      const icon = el.querySelector(".nav-item-icon");
      assert.equal(count.textContent.trim(), "3");
      assert.equal(count.parentElement, icon, "inside the icon, not after the label");
      const c = count.getBoundingClientRect();
      const i = el.querySelector("lc-icon").getBoundingClientRect();
      assert.ok(c.left > i.left + i.width / 2 - 1 && c.top < i.top, "over the glyph's top right");
    }
    assert.equal(els[0].querySelector(".nav-item-badge"), null, "the badge stays what it was");
  });

  it("rings itself in what it sits on: the bar idle, the active fill when active", async () => {
    const [idle, active] = els.map((el) => getComputedStyle(el.querySelector(".nav-item-count")).boxShadow);
    assert.match(idle, /rgb\(31, 26, 23\)/);
    assert.match(active, /rgb\(251, 239, 118\)/);
  });

  it("draws nothing with no count", async () => {
    els[0].setAttribute("count", "");
    await waitFor(() => !els[0].querySelector(".nav-item-count"), "count gone");
  });
});

describe("lc-nav-item active bar", () => {
  let el;

  before(async () => {
    if (!customElements.get("lc-nav-item")) View.define("lc-nav-item", navItemDef);
    el = document.createElement("lc-nav-item");
    el.setAttribute("label", "Today");
    el.setAttribute("active", "");
    el.setAttribute("active-bg", "");
    el.style.cssText = "display:flex;width:200px;--lc-nav-item-active-bar-width:3px;--lc-nav-item-active-bar-color:rgb(250, 189, 47)";
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  after(() => el.remove());

  it("draws the bar the theme asks for inside the active item's left edge", () => {
    const shadow = getComputedStyle(el).boxShadow;
    assert.match(shadow, /inset/, "the bar is an inset shadow");
    assert.match(shadow, /rgb\(250, 189, 47\)/, "in the bar colour");
    assert.match(shadow, /3px 0px 0px 0px/, "as wide as asked, with no blur or spread");
  });
});

describe("lc-nav-item dot", () => {
  let el;

  before(async () => {
    if (!customElements.get("lc-nav-item")) View.define("lc-nav-item", navItemDef);
    el = document.createElement("lc-nav-item");
    el.setAttribute("icon-only", "");
    el.setAttribute("icon", "user");
    el.setAttribute("label", "You");
    el.setAttribute("dot", "");
    el.style.cssText = "width:48px;height:48px";
    document.body.appendChild(el);
  });

  after(() => el.remove());

  it("puts the dot on the icon's corner, and takes it off with the attribute", async () => {
    await waitFor(() => el.querySelector(".nav-item-dot"), "dot");
    const dot = el.querySelector(".nav-item-dot");
    assert.equal(dot.parentElement, el.querySelector(".nav-item-icon"), "the dot rides the icon");
    assert.equal(getComputedStyle(dot).position, "absolute");
    el.removeAttribute("dot");
    await waitFor(() => !el.querySelector(".nav-item-dot"), "no dot");
  });
});
