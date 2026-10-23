import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: radioGroupDef } = await import("./radio-group.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

const mount = async () => {
  const group = /** @type {any} */ (document.createElement("lc-radio-group"));
  group.setAttribute("name", "plan");
  for (const value of ["free", "pro"]) {
    const radio = document.createElement("lc-radio");
    /** @type {any} */ (radio).value = value;
    group.append(radio);
  }
  document.body.append(group);
  mounted.push(group);
  await tick();
  await group.$requestUpdate();

  /** @type {unknown[]} */
  const changes = [];
  group.addEventListener("change", (/** @type {any} */ e) => changes.push(e.detail?.value));
  return { group, changes, radios: [...group.querySelectorAll("lc-radio")] };
};

/** @param {Element} radio */
const pick = (radio) =>
  radio.dispatchEvent(new CustomEvent("change", {
    detail: { checked: true, value: /** @type {any} */ (radio).value },
    bubbles: false,
  }));

describe("@bootstrapp/light - lc-radio-group", () => {
  before(() => View.define("lc-radio-group", radioGroupDef));

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("reports one change per pick", async () => {
    const { group, changes, radios } = await mount();

    pick(radios[1]);
    assert.deepEqual(changes, ["pro"]);
    assert.equal(group.value, "pro");
  });

  it("still reports one change after the slot has been resynced many times", async () => {
    const { changes, radios, group } = await mount();

    for (let i = 0; i < 5; i++) group.handleSlotChange();
    pick(radios[1]);

    assert.deepEqual(changes, ["pro"], "the listener is replaced on each sync, never stacked");
  });

  it("ignores a radio reporting that it was unchecked", async () => {
    const { changes, radios } = await mount();

    radios[0].dispatchEvent(new CustomEvent("change", { detail: { checked: false, value: "free" } }));
    assert.deepEqual(changes, []);
  });

  it("keeps every radio in step with the group's value", async () => {
    const { group, radios } = await mount();

    group.value = "pro";
    await group.$requestUpdate();

    assert.equal(/** @type {any} */ (radios[0]).checked, false);
    assert.equal(/** @type {any} */ (radios[1]).checked, true);
    assert.equal(/** @type {any} */ (radios[0]).name, "plan", "and carries the group's name");
  });

  it("stops listening when it is removed", async () => {
    const { group, changes, radios } = await mount();

    group.remove();
    await tick();
    pick(radios[1]);

    assert.deepEqual(changes, [], "a detached group answers nothing");
  });
});
