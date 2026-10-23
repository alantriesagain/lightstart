import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: rowDef } = await import("./list-row.js");
const { default: badgeDef } = await import("./badge.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The sibling sheets the way the app gets them, in the document.
 * @param {string[]} names
 */
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
  const el = /** @type {any} */ (document.createElement("lc-list-row"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-list-row", () => {
  before(async () => {
    if (!customElements.get("lc-badge")) View.define("lc-badge", badgeDef);
    if (!customElements.get("lc-list-row")) View.define("lc-list-row", rowDef);
    await loadStyles("list-row", "badge");
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("draws the label, the hint and the meta, as a button when it leads nowhere", async () => {
    const el = await mount({ label: "Devices", hint: "Rack cam", meta: "2h" });
    const root = el;
    assert.equal(root.querySelector("[part~=lc-list-row-label]")?.textContent?.trim(), "Devices");
    assert.equal(root.querySelector("[part~=lc-list-row-hint]")?.textContent?.trim(), "Rack cam");
    assert.equal(root.querySelector("[part~=lc-list-row-meta]")?.textContent?.trim(), "2h");
    assert.ok(root.querySelector("button[part~=lc-list-row-row]"));
    assert.equal(root.querySelector("a[part~=lc-list-row-row]"), null);
  });

  it("marks a row nobody has read with a dot, and drops it once read", async () => {
    const el = await mount({ label: "Ana asked to join", meta: "2h", unread: "" });
    const dot = el.querySelector("[part~=lc-list-row-dot]");
    assert.ok(dot, "an unread row carries the dot");
    assert.equal(dot.tagName.toLowerCase(), "lc-badge");
    assert.equal(dot.hasAttribute("dot"), true, "as a dot rather than an empty badge");

    el.removeAttribute("unread");
    await el.$requestUpdate();
    assert.equal(el.querySelector("[part~=lc-list-row-dot]"), null);
  });

  it("truncates to one line by default, and wraps the whole text when asked", async () => {
    const hint = "Find the spots, meetups and nights out that people who live here recommend. Save what you like and take it with you.";
    const one = await mount({ label: "Welcome to meetup.rio", hint, meta: "2 months ago" });
    one.style.width = "320px";
    const wrapped = await mount({ label: "Welcome to meetup.rio", hint, meta: "2 months ago", wrap: "" });
    wrapped.style.width = "320px";
    await tick();
    const height = (el) => el.querySelector("[part~=lc-list-row-hint]").getBoundingClientRect().height;
    const line = height(one);
    assert.equal(getComputedStyle(one.querySelector("[part~=lc-list-row-hint]")).whiteSpace, "nowrap");
    assert.ok(height(wrapped) > line * 2, `the wrapped hint runs past one line: ${height(wrapped)} vs ${line}`);
    assert.ok(wrapped.querySelector("[part~=lc-list-row-text] [part~=lc-list-row-meta]"), "a wrapping row carries its meta under the text");
    assert.equal(one.querySelector("[part~=lc-list-row-text] [part~=lc-list-row-meta]"), null, "a one-line row keeps it on the right");
  });

  it("the dot sits before the chevron, so the row reads left to right", async () => {
    const el = await mount({ label: "Ana asked to join", chevron: "", unread: "" });
    const trailing = [...el.querySelectorAll("[part~=lc-list-row-dot], [part~=lc-list-row-chevron]")].map((n) => n.getAttribute("part"));
    assert.deepEqual(trailing, ["lc-list-row-dot", "lc-list-row-chevron"]);
  });

  it("the row colours its own dot through the badge's variable, inside the shadow root", async () => {
    const el = await mount({ label: "Ana asked to join", unread: "" });
    el.style.setProperty("--lc-list-row-unread-color", "rgb(4, 5, 6)");
    await el.$requestUpdate();
    const dot = el.querySelector("[part~=lc-list-row-dot]");
    assert.equal(getComputedStyle(dot).backgroundColor, "rgb(4, 5, 6)");
    assert.equal(Number.parseFloat(getComputedStyle(dot).paddingLeft), 0, "and it is a dot, so the badge's own sheet reached into the shadow root");
  });

  it("emits select on a click, and a disabled row emits nothing", async () => {
    const el = await mount({ label: "Devices" });
    let selected = 0;
    el.addEventListener("select", () => selected++);
    el.querySelector("[part~=lc-list-row-row]").click();
    assert.equal(selected, 1);

    el.setAttribute("disabled", "");
    await el.$requestUpdate();
    el.querySelector("[part~=lc-list-row-row]").click();
    assert.equal(selected, 1);
  });

  it("a flat row has neither surface nor border", async () => {
    const el = await mount({ label: "Done", flat: "", style: "--lc-list-row-border-width: 1px; --lc-list-row-border-color: rgb(7, 8, 9)" });
    const row = el.querySelector("[part~=lc-list-row-row]");
    assert.equal(getComputedStyle(row).backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(getComputedStyle(row).borderTopColor, "rgba(0, 0, 0, 0)");
  });

  it("a static row is a plain box: no button, no select, and a control in its slot works on its own", async () => {
    const el = await mount({ label: "Devices", static: "" });
    const button = document.createElement("button");
    button.slot = "trailing";
    button.textContent = "Remove";
    el.append(button);
    await el.$requestUpdate();
    let selected = 0;
    let removed = 0;
    el.addEventListener("select", () => selected++);
    button.addEventListener("click", () => removed++);
    const row = el.querySelector("[part~=lc-list-row-row]");
    assert.equal(row.tagName.toLowerCase(), "div");
    assert.equal(el.querySelector("button[part~=lc-list-row-row], a[part~=lc-list-row-row]"), null);
    assert.equal(getComputedStyle(row).cursor, "default");
    row.click();
    button.click();
    assert.equal(selected, 0, "the row is not a control");
    assert.equal(removed, 1, "its control is");
  });

  it("tints a selected row through its variable and marks it current", async () => {
    const plain = await mount({ label: "Recap" });
    const el = await mount({ label: "Launch", selected: "" });
    const row = el.querySelector("[part~=lc-list-row-row]");
    assert.equal(row.getAttribute("aria-current"), "true");
    assert.equal(plain.querySelector("[part~=lc-list-row-row]").getAttribute("aria-current"), null);
    assert.notEqual(getComputedStyle(row).backgroundColor, getComputedStyle(plain.querySelector("[part~=lc-list-row-row]")).backgroundColor);
    const themed = await mount({ label: "Themed", selected: "", style: "--lc-list-row-selected-background: rgb(1, 2, 3); --lc-list-row-selected-border-color: rgb(7, 8, 9); --lc-list-row-border-width: 1px" });
    assert.equal(getComputedStyle(themed.querySelector("[part~=lc-list-row-row]")).backgroundColor, "rgb(1, 2, 3)");
    assert.equal(getComputedStyle(themed.querySelector("[part~=lc-list-row-row]")).borderTopColor, "rgb(7, 8, 9)", "and its border through its own variable");
  });
});
