import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import previewDef from "./preview.js";
import propertyEditorDef from "./property-editor.js";

/**
 * @param {() => boolean} predicate
 * @param {string} label
 * @param {number} [timeout]
 */
const waitFor = async (predicate, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

/**
 * @param {string} name
 * @returns {HTMLElement & { name: string, example: number }}
 */
const previewOf = (name) => {
  const el = document.createElement("showcase-preview");
  Object.assign(el, { name });
  document.body.append(el);
  return /** @type {HTMLElement & { name: string, example: number }} */ (el);
};

const stageButtons = (/** @type {HTMLElement} */ el) =>
  /** @type {HTMLElement[]} */ ([...el.querySelectorAll(".showcase-preview__stage lc-button")]);

describe("showcase-preview renders a demo", () => {
  /** @type {HTMLElement & { name: string, example: number }} */
  let preview;

  before(async () => {
    if (!customElements.get("showcase-preview")) View.define("showcase-preview", previewDef);
    preview = previewOf("button");
    await waitFor(() => stageButtons(preview).length > 0, "the first example");
  });

  after(() => preview.remove());

  it("draws the demo's first example", () => {
    const buttons = stageButtons(preview);
    assert.equal(buttons[0].textContent.trim(), "Click me");
  });

  it("draws another example when the example index changes", async () => {
    preview.example = 1;
    await waitFor(() => stageButtons(preview).length >= 5, "the variants example");
    const labels = stageButtons(preview).map((button) => button.textContent.trim());
    assert.ok(labels.includes("Primary"), "the variants example names its buttons");
  });
});

describe("showcase-property-editor changes the previewed element", () => {
  /** @type {HTMLElement & { name: string, example: number }} */
  let preview;
  /** @type {HTMLElement} */
  let editor;

  before(async () => {
    if (!customElements.get("showcase-preview")) View.define("showcase-preview", previewDef);
    if (!customElements.get("showcase-property-editor")) View.define("showcase-property-editor", propertyEditorDef);
    preview = previewOf("button");
    await waitFor(() => stageButtons(preview).length > 0, "the previewed button");

    editor = document.createElement("showcase-property-editor");
    Object.assign(editor, {
      declarations: { primary: { type: "boolean", defaultValue: false } },
      values: { primary: false },
    });
    document.body.append(editor);
    await waitFor(() => editor.querySelector("lc-checkbox input") !== null, "the boolean control");
  });

  after(() => {
    preview.remove();
    editor.remove();
  });

  it("carries a prop change from its control to the previewed element", async () => {
    const button = /** @type {HTMLElement & { primary: boolean }} */ (stageButtons(preview)[0]);
    /** @type {{ key: string, value: unknown } | null} */
    let changed = null;
    editor.addEventListener("property-change", (event) => {
      const detail = /** @type {CustomEvent<{ key: string, value: unknown }>} */ (event).detail;
      changed = detail;
      if (detail.key === "primary") button.toggleAttribute("primary", detail.value === true);
    });

    const input = /** @type {HTMLInputElement} */ (editor.querySelector("lc-checkbox input"));
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await waitFor(() => button.hasAttribute("primary"), "the previewed button to wear the prop");
    assert.deepEqual(changed, { key: "primary", value: true });
    assert.equal(button.primary, true, "the attribute reached the component's prop");
  });
});
