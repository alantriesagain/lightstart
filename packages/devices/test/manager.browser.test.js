import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import View from "@lightstart/light";
import { syncPlugin } from "@lightstart/light/controller/view";
import managerDef from "../views/manager.js";
import devices from "../controllers/devices.js";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

/** @template T @param {() => T | null | undefined} get @param {string} what @returns {Promise<T>} */
const until = async (get, what) => {
  for (let i = 0; i < 120; i++) {
    const found = get();
    if (found) return found;
    await frame();
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** @type {HTMLElement[]} */
const mounted = [];

const mount = () => {
  View.use(syncPlugin);
  if (!customElements.get("devices-manager")) View.define("devices-manager", managerDef);
  const el = document.createElement("devices-manager");
  document.body.appendChild(el);
  mounted.push(el);
  return el;
};

after(() => {
  for (const el of mounted.splice(0)) el.remove();
});

describe("devices-manager", () => {
  it("draws the remembered devices and the way to add one", async () => {
    devices.available = true;
    devices.known = [
      { id: "AA:BB", name: "GoPro Hero", driver: "gopro", autoConnect: true },
    ];
    const el = mount();
    const add = await until(() => /** @type {HTMLElement | null} */ (el.querySelector("[data-add-device]")), "the add button");
    assert.match(add.textContent ?? "", /Add device/);
    const card = await until(() => /** @type {HTMLElement | null} */ (el.querySelector('[data-device="AA:BB"]')), "the device card");
    assert.match(card.textContent ?? "", /GoPro Hero/);
    assert.match(card.textContent ?? "", /Not connected/);
  });
});
