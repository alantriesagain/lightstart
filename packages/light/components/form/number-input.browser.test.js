/**
 * `<lc-number-input>` with no value. The prop defaults to `null` rather than
 * `0`, so this pins the three places that shape shows: an empty control
 * renders empty (not "0" and not "Invalid"), the form value it publishes is
 * the empty string, and nudging from null starts at zero.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import numberInputDef from "@bootstrapp/light/components/form/number-input.js";
import labelDef from "@bootstrapp/light/components/form/label.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};

const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();

describe("lc-number-input with no value", () => {
  let el;

  before(async () => {
    define("lc-label", labelDef);
    define("lc-number-input", numberInputDef);
    el = document.createElement("lc-number-input");
    document.body.appendChild(el);
    await rendered(el);
  });

  after(() => el.remove());

  it("starts at null and renders an empty input", () => {
    assert.equal(el.value, null);
    const input = el.querySelector("input");
    assert.ok(input, "the control renders an input");
    assert.equal(input.value, "");
  });

  it("publishes an empty form value while it has none", () => {
    /** @type {string[]} */
    const published = [];
    el.syncFormValue = (value) => published.push(value);
    el._updateFormValue();
    assert.deepEqual(published, [""]);
  });

  it("nudges from null as if it were zero", async () => {
    el.step = 5;
    el.increment();
    await rendered(el);
    assert.equal(el.value, 5);
    assert.equal(el.querySelector("input").value, "5");
  });

  it("goes back to null when the input is cleared", async () => {
    const input = el.querySelector("input");
    input.value = "";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await rendered(el);
    assert.equal(el.value, null);
    assert.equal(el.querySelector("input").value, "");
  });
});
