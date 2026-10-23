import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import { overlays } from "./stack.js";

const { default: dropdownDef } = await import("./dropdown.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const escape = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

/** @param {string} key */
const press = (key) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

/** @type {Element[]} */
const mounted = [];

const open = async (/** @type {string[]} */ labels = []) => {
  const trigger = document.createElement("button");
  const menu = /** @type {any} */ (document.createElement("lc-dropdown"));
  if (labels.length) menu.items = labels.map((label) => ({ label }));
  document.body.append(trigger, menu);
  mounted.push(trigger, menu);
  await tick();

  menu.toggle(trigger);
  await menu.$requestUpdate();
  assert.equal(menu.open, true, "the trigger opened it");
  assert.equal(menu.hasAttribute("data-open"), true);
  return { trigger, menu };
};

describe("@bootstrapp/light - lc-dropdown", () => {
  before(() => View.define("lc-dropdown", dropdownDef));

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("dismisses on a click outside", async () => {
    const { menu } = await open();

    document.body.click();
    await menu.$requestUpdate();
    assert.equal(menu.open, false);
    assert.equal(menu.hasAttribute("data-open"), false);
  });

  it("ignores the click that lands on its own trigger", async () => {
    const { trigger, menu } = await open();

    trigger.click();
    await menu.$requestUpdate();
    assert.equal(menu.open, true, "the trigger's own click is the toggle, not a dismissal");
  });

  it("answers Escape", async () => {
    const { menu } = await open();

    escape();
    await menu.$requestUpdate();
    assert.equal(menu.open, false);
  });

  it("leaves Escape alone once it is closed", async () => {
    const { trigger, menu } = await open();
    menu.toggle(trigger);
    await menu.$requestUpdate();
    assert.equal(menu.open, false);

    const before = overlays.stack.value.length;
    escape();
    await tick();
    assert.equal(overlays.stack.value.length, before);
  });

  it("enters from the top on the first ArrowDown and the bottom on the first ArrowUp", async () => {
    const { menu } = await open(["One", "Two", "Three"]);
    const rows = () => [...menu.querySelectorAll("button.lc-dropdown-item")];

    press("ArrowDown");
    assert.equal(document.activeElement, rows()[0], "nothing focused yet, so ArrowDown takes the first");

    /** @type {HTMLElement} */ (document.activeElement).blur();
    press("ArrowUp");
    assert.equal(document.activeElement, rows()[2], "and ArrowUp takes the last");
  });

  it("wraps at both ends", async () => {
    const { menu } = await open(["One", "Two", "Three"]);
    const rows = () => [...menu.querySelectorAll("button.lc-dropdown-item")];

    rows()[2].focus();
    press("ArrowDown");
    assert.equal(document.activeElement, rows()[0], "past the last is the first");

    press("ArrowUp");
    assert.equal(document.activeElement, rows()[2], "and back again");
  });

  it("takes a render callback for a body that changes while it is open", async () => {
    let step = "menu";
    const trigger = document.createElement("button");
    const menu = /** @type {any} */ (document.createElement("lc-dropdown"));
    menu.items = [{ label: "Report", onClick: () => { step = "form"; } }];
    menu.content = () => (step === "form" ? html`<textarea data-why></textarea>` : "");
    document.body.append(trigger, menu);
    mounted.push(trigger, menu);
    await tick();
    menu.toggle(trigger);
    await menu.$requestUpdate();

    assert.equal(menu.querySelector("[data-why]"), null, "the first step draws nothing of the second");

    step = "form";
    await menu.$requestUpdate();
    assert.ok(menu.querySelector("[data-why]"),
      "the callback answers for the step it is on, which a slot snapshotted at connect cannot");
  });

  it("comes off the overlay stack when it is removed mid-open", async () => {
    const { menu } = await open();
    assert.equal(overlays.stack.value.length, 1);

    menu.remove();
    await tick();
    assert.equal(overlays.stack.value.length, 0);
  });
});
