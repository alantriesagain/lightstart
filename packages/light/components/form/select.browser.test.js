import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import selectDef from "./select.js";
import tagDef from "../display/tag.js";

const waitFor = async (predicate, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe("lc-select inside a reset", () => {
  let el;

  before(async () => {
    if (!customElements.get("lc-select")) View.define("lc-select", selectDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./select.css", import.meta.url).href;
    const loaded = new Promise((resolve) => { sheet.onload = resolve; sheet.onerror = resolve; });
    document.head.append(sheet);
    await loaded;
    const reset = document.createElement("style");
    reset.textContent = "button, textarea, select { background: inherit; }";
    document.head.append(reset);
    el = document.createElement("lc-select");
    el.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
    el.value = "a";
    el.style.cssText = "--lc-select-border-radius:9999px;--lc-select-background:rgb(255, 255, 255)";
    document.body.appendChild(el);
  });

  after(() => el.remove());

  it("keeps the control transparent, so a rounded wrapper stays rounded", async () => {
    await waitFor(() => el.querySelector(".select-wrapper select"), "the control");
    const wrapper = el.querySelector(".select-wrapper");
    const control = el.querySelector("select");
    assert.equal(getComputedStyle(wrapper).borderRadius, "9999px");
    assert.equal(getComputedStyle(wrapper).backgroundColor, "rgb(255, 255, 255)");
    assert.equal(getComputedStyle(control).backgroundColor, "rgba(0, 0, 0, 0)", "the control does not paint the wrapper's corners square");
  });
});

describe("lc-select typed into, many at once: the picks as tags", () => {
  let el;
  /** @type {unknown[]} */
  let changes;

  const field = () => /** @type {HTMLInputElement | null} */ (el.querySelector(".select-tags-input"));
  const type = (text) => {
    const input = /** @type {HTMLInputElement} */ (field());
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const key = (name) => field()?.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
  const shown = () => [...el.querySelectorAll(".select-dropdown .select-option")].map((o) => /** @type {HTMLElement} */ (o).dataset.value);
  const tags = () => [...el.querySelectorAll(".select-tag")].map((t) => /** @type {HTMLElement} */ (t).dataset.value);

  before(async () => {
    if (!customElements.get("lc-tag")) View.define("lc-tag", tagDef);
    changes = [];
    el = document.createElement("lc-select");
    el.multiple = true;
    el.searchable = true;
    el.max = 2;
    el.label = "Languages";
    el.options = [
      { value: "af", label: "Afrikaans" },
      { value: "en", label: "English", leading: "E" },
      { value: "fr", label: "French", leading: "F" },
      { value: "fy", label: "Frisian" },
    ];
    el.addEventListener("change", (/** @type {CustomEvent} */ e) => changes.push(e.detail.value));
    document.body.appendChild(el);
    await waitFor(() => field(), "the field to type into");
  });

  after(() => el.remove());

  it("lists what starts with the letters first, and Enter makes the first a tag", async () => {
    type("fr");
    await waitFor(() => shown().length === 3, "three matches");
    assert.deepEqual(shown(), ["fr", "fy", "af"], "a word that starts with it comes before one that only contains it");
    key("Enter");
    await waitFor(() => tags().length === 1, "the tag");
    assert.deepEqual(tags(), ["fr"]);
    assert.deepEqual(el.value, ["fr"]);
    assert.deepEqual(changes.at(-1), ["fr"]);
    assert.equal(field()?.value, "", "the field empties for the next one");
    assert.equal(el.querySelector('.select-tag[data-value="fr"] .select-leading')?.textContent, "F", "the tag carries its mark");
    assert.equal(el.querySelector(".select-count")?.textContent, "1 of 2");
  });

  it("takes no more than max, and the field goes once it is full", async () => {
    type("eng");
    await waitFor(() => shown()[0] === "en", "English");
    key("Enter");
    await waitFor(() => tags().length === 2, "the second tag");
    assert.equal(field(), null);
    assert.equal(el.querySelector(".select-count")?.textContent, "2 of 2");
  });

  it("an x takes a tag off, and so does Backspace in an empty field", async () => {
    const close = el.querySelector('.select-tag[data-value="fr"]')?.querySelector("[part~=lc-tag-close]");
    /** @type {HTMLElement} */ (close).click();
    await waitFor(() => tags().length === 1, "one tag left");
    assert.deepEqual(el.value, ["en"]);
    await waitFor(() => field(), "the field back");
    key("Backspace");
    await waitFor(() => tags().length === 0, "no tags");
    assert.deepEqual(el.value, []);
  });
});
