/**
 * `<lc-language-switcher>` reads light's translation contract: the languages
 * on offer, the current one, and `setLanguage` when another is chosen. A fake
 * provider stands in for a library, so no real translation is loaded.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import { configureTranslation } from "@lightstart/light/i18n";
import languageSwitcherDef from "./language-switcher.js";

const waitFor = async (predicate, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

const fakeProvider = () => {
  const words = { en: { hello: "Hello" }, pt: { hello: "Olá" } };
  const subscribers = new Set();
  const calls = [];
  let current = "en";

  return {
    calls,
    translate(key) {
      return words[current][key];
    },
    language() {
      return current;
    },
    languages() {
      return ["en", "pt"];
    },
    setLanguage(language) {
      calls.push(language);
      current = language;
      for (const fn of subscribers) fn();
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
};

describe("lc-language-switcher", () => {
  const provider = fakeProvider();
  /** @type {HTMLElement} */
  let el;

  before(async () => {
    configureTranslation(provider);
    if (!customElements.get("lc-language-switcher")) View.define("lc-language-switcher", languageSwitcherDef);
    el = document.createElement("lc-language-switcher");
    document.body.appendChild(el);
    await waitFor(() => el.querySelector("select"), "select");
  });

  after(() => el.remove());

  it("offers every language with the current one selected", () => {
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    const values = [...select.options].map((option) => option.value);
    assert.deepEqual(values, ["en", "pt"], "both languages are offered");
    assert.equal(select.value, "en", "en is current");
    assert.equal(select.querySelector('option[value="en"]').selected, true);
  });

  it("asks the provider for another and shows it as current", async () => {
    const select = /** @type {HTMLSelectElement} */ (el.querySelector("select"));
    select.value = "pt";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    assert.deepEqual(provider.calls, ["pt"], "the provider got setLanguage(pt)");
    await waitFor(() => select.querySelector('option[value="pt"]').selected, "pt selected");
    assert.equal(select.value, "pt", "the switcher shows pt as current");
  });
});
