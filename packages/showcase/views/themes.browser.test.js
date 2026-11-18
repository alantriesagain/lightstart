import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";

const { default: themeEditorDef } = await import("./theme-editor.js");
const { default: themeGeneratorDef } = await import("./theme-generator.js");
const { default: cssEditorDef } = await import("./css-editor.js");

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

/**
 * @template T
 * @param {() => T | null | undefined} get
 * @param {string} what
 * @returns {Promise<T>}
 */
const until = async (get, what) => {
  for (let i = 0; i < 240; i++) {
    const found = get();
    if (found) return found;
    await frame();
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** @type {Element[]} */
const mounted = [];

/** @param {Element} el */
const mount = (el) => {
  document.body.append(el);
  mounted.push(el);
  return el;
};

/**
 * @typedef {HTMLElement & {
 *   values: Record<string, Record<string, string>>,
 *   _updateValue(category: string, key: string, value: string): void,
 * }} ThemeEditorElement
 * @typedef {HTMLElement & {
 *   componentTag: string,
 *   cssVariables: Map<string, { fallback: string, varName: string }> | null,
 * }} CssEditorElement
 */

describe("@lightstart/showcase - theme tools", () => {
  before(() => {
    if (!customElements.get("showcase-theme-editor")) View.define("showcase-theme-editor", themeEditorDef);
    if (!customElements.get("showcase-theme-generator")) View.define("showcase-theme-generator", themeGeneratorDef);
    if (!customElements.get("showcase-css-editor")) View.define("showcase-css-editor", cssEditorDef);
  });

  after(() => {
    for (const el of mounted.splice(0)) el.remove();
  });

  it("applies a token changed in the generator's editor as its CSS variable", async () => {
    const el = mount(document.createElement("showcase-theme-generator"));
    const editor = /** @type {ThemeEditorElement} */ (await until(
      () => {
        const found = el.querySelector("showcase-theme-editor");
        return found && Object.keys(/** @type {ThemeEditorElement} */ (found).values ?? {}).length > 0
          ? found
          : null;
      },
      "the theme editor's values",
    ));

    editor._updateValue("color", "primary", "#00ff00");

    const value = await until(
      () => {
        const applied = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
        return applied === "#00ff00" ? applied : null;
      },
      "the applied --color-primary",
    );
    assert.equal(value, "#00ff00");
  });

  it("shows the variables a component's stylesheet reads", async () => {
    const el = /** @type {CssEditorElement} */ (mount(document.createElement("showcase-css-editor")));
    el.componentTag = "lc-button";

    const variables = /** @type {Map<string, { fallback: string, varName: string }>} */ (await until(
      () => {
        const found = el.cssVariables;
        return found && found.size > 0 ? found : null;
      },
      "the button stylesheet's variables",
    ));

    assert.ok(variables.has("background"), "the button's background variable is read from its stylesheet");
    assert.equal(variables.get("background")?.varName, "--lc-button-background");

    const row = await until(
      () => el.querySelector('[title="--lc-button-background"]'),
      "a variable row in the editor",
    );
    assert.equal(row.textContent?.trim(), "background");
  });
});
