import assert from "node:assert/strict";
import { describe, it } from "node:test";
import View from "@bootstrapp/light";
import T from "@bootstrapp/light/types";
import { html } from "@bootstrapp/light/html";
import { defineController, nameControllers, registerAdapter } from "@bootstrapp/light/controller";
import { localStorage } from "@bootstrapp/light/controller/storage";
import { syncPlugin } from "@bootstrapp/light/controller/view";

View.use(syncPlugin);
registerAdapter("local", localStorage);

let counter = 0;
const uniqueTag = (prefix) => `${prefix}-${Date.now()}-${++counter}`;

describe("@bootstrapp/light/controller: a page with no framework", () => {
  it("binds a component property to local storage and to a controller by name", async () => {
    globalThis.localStorage.removeItem("lightSyncTheme");
    const prefs = defineController({ name: "lightSyncPrefs", props: { density: "comfy" } });
    nameControllers([prefs]);

    const tag = uniqueTag("light-sync");
    View.define(tag, {
      props: {
        lightSyncTheme: T.string({ defaultValue: "light", sync: "local" }),
        density: T.string({ defaultValue: "", sync: "lightSyncPrefs" }),
      },
      render() {
        return html`<span>${this.lightSyncTheme}/${this.density}</span>`;
      },
    });
    const el = /** @type {any} */ (document.createElement(tag));
    document.body.appendChild(el);
    await el.$requestUpdate();
    assert.equal(el.querySelector("span").textContent, "light/comfy", "the controller's value beats the component's default");

    el.lightSyncTheme = "dark";
    await el.$requestUpdate();
    assert.equal(globalThis.localStorage.getItem("lightSyncTheme"), "dark", "a string is stored raw");

    prefs.density = "compact";
    await el.$requestUpdate();
    assert.equal(el.querySelector("span").textContent, "dark/compact", "a controller change reaches the component");
    el.density = "roomy";
    assert.equal(prefs.density, "roomy", "the binding is two-way");
    assert.equal(el.hasAttribute("light-sync-theme"), false, "a synced property is not reflected to an attribute");

    el.remove();
    prefs.dispose();
    globalThis.localStorage.removeItem("lightSyncTheme");
  });
});
