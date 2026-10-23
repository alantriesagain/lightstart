import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: linkDef } = await import("./link.js");
const { default: buttonDef } = await import("./button.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

const mount = (/** @type {Element} */ el) => {
  document.body.append(el);
  mounted.push(el);
  return el;
};

const button = async (/** @type {Record<string, string>} */ attrs = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-button"));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  mount(el);
  await el.$requestUpdate();
  return el;
};

const anchorOf = (/** @type {any} */ el) => el.querySelector("[part~=lc-link-anchor]");

describe("@bootstrapp/light - lc-button inherits lc-link's click wiring", () => {
  before(() => {
    View.define("lc-link", linkDef);
    View.define("lc-button", buttonDef);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("submits the form it sits in", async () => {
    const form = /** @type {HTMLFormElement} */ (mount(document.createElement("form")));
    let submitted = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitted++;
    });
    const el = /** @type {any} */ (document.createElement("lc-button"));
    el.setAttribute("type", "submit");
    form.append(el);
    await el.$requestUpdate();

    anchorOf(el).click();
    assert.equal(submitted, 1);
  });

  it("drives a popovertarget through the overlay's trigger protocol", async () => {
    const target = mount(document.createElement("div"));
    target.id = "menu";
    const triggers = [];
    /** @type {any} */ (target).toggle = (trigger) => triggers.push(trigger);

    const el = await button({ popovertarget: "menu" });
    anchorOf(el).click();
    assert.deepEqual(triggers, [el], "the lc-button itself is the trigger the overlay anchors to");
  });

  it("honours popovertargetaction", async () => {
    const target = mount(document.createElement("div"));
    target.id = "panel";
    const calls = [];
    Object.assign(/** @type {any} */ (target), {
      toggle: () => calls.push("toggle"),
      _open: () => calls.push("open"),
      _close: () => calls.push("close"),
    });

    const show = await button({ popovertarget: "panel", popovertargetaction: "show" });
    anchorOf(show).click();
    const hide = await button({ popovertarget: "panel", popovertargetaction: "hide" });
    anchorOf(hide).click();
    assert.deepEqual(calls, ["open", "close"]);
  });

  it("exposes click() so an agent driving the page reaches the anchor", async () => {
    const el = await button({ popovertarget: "absent" });
    assert.equal(typeof el.click, "function");

    let reached = 0;
    anchorOf(el).addEventListener("click", () => reached++);
    el.click();
    assert.equal(reached, 1);
  });

  it("is a button when it has no href, and a link when it has one", async () => {
    const plain = await button();
    assert.equal(anchorOf(plain).tagName, "BUTTON", "nothing to navigate to, so nothing announces as a link");
    assert.equal(anchorOf(plain).type, "button", "and it never submits the form it sits in by accident");

    const linked = await button({ href: "/somewhere" });
    assert.equal(anchorOf(linked).tagName, "A");
  });

  it("takes the disabled attribute the platform understands", async () => {
    const el = await button({ disabled: "" });
    const anchor = anchorOf(el);
    assert.equal(anchor.disabled, true, "a real button is disabled, not painted disabled");

    let clicks = 0;
    el.addEventListener("click", () => clicks++);
    anchor.click();
    assert.equal(clicks, 0);
  });

  it("carries the DOM's click from the moment it exists", () => {
    const el = /** @type {any} */ (document.createElement("lc-button"));
    mount(el);
    assert.equal(typeof el.click, "function", "before the first render, with no property shadowing it");
  });

  it("delivers a host click to a @click listener exactly once", async () => {
    const el = await button();
    let clicks = 0;
    el.addEventListener("click", () => clicks++);

    el.click();
    await tick();
    assert.equal(clicks, 1, "forwarding to the anchor must not deliver the same click twice");
  });

  it("does not swallow a click a consumer bound on the host", async () => {
    const el = await button();
    let clicks = 0;
    el.addEventListener("click", () => clicks++);

    anchorOf(el).click();
    assert.equal(clicks, 1, "the shadow click still composes out to the host");
  });
});
