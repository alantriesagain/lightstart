/**
 * The catalogue and the component page, and the skin they dress a stage in.
 *
 * The catalogue browses the components' tags table (`componentTags()`), so
 * these cases assert against the whole package the table lists: a category is
 * every directory that holds one, and a component is a name the table names.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import { render } from "@lightstart/light/html";
import { componentTags, loadDemo } from "../lib/load.ts";
import { CATEGORIES, browsableCategories } from "../lib/categories.ts";
import { codeOf } from "../lib/demos.ts";
import { applySkin, clearSkin, skinScope } from "../lib/skins.ts";
import catalogueDef from "./catalogue.js";
import componentDocDef from "./component-doc.js";
import exampleDef from "@lightstart/components/display/example.js";
import buttonDef from "@lightstart/components/display/button.js";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

/**
 * @param {() => unknown} get
 * @param {string} what
 */
const until = async (get, what) => {
  for (let i = 0; i < 240; i++) {
    const found = get();
    if (found) return found;
    await frame();
  }
  throw new Error(`timed out waiting for ${what}`);
};

/**
 * @param {string} tag
 * @param {Record<string, unknown>} definition
 */
const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};

/**
 * @typedef {HTMLElement & {
 *   search: string, uri: string, isHosted(): boolean,
 *   open(category: string, name: string): void,
 * }} CatalogueElement
 */

/**
 * @typedef {HTMLElement & {
 *   category: string, name: string, skin: string, loading: boolean, error: string,
 *   appliedSkin: string, selectedComponent: unknown, demo: { examples: unknown[] } | null,
 *   open(category: string, name: string): void,
 * }} DocElement
 */

describe("the showcase catalogue", () => {
  it("offers only the directories that are categories", () => {
    const ids = browsableCategories(componentTags()).map((category) => category.id);
    assert.deepEqual(ids, CATEGORIES.map((category) => category.id));
    assert.ok(!ids.includes("docs"), "the showcase lists itself");
    assert.ok(!ids.includes("theme"));
    assert.ok(!ids.includes("views"));
  });

  it("filters components by name and drops a category that keeps none", () => {
    const listings = browsableCategories(componentTags(), "but");
    assert.deepEqual(listings.map((category) => [category.id, category.components]), [["display", ["button"]]]);
  });
});

describe("a skin", () => {
  const adoptedCss = () =>
    document.adoptedStyleSheets
      .map((sheet) => [...sheet.cssRules].map((rule) => rule.cssText).join("\n"))
      .join("\n");

  after(() => clearSkin("neobrutalist"));

  it("dresses only the scope it is applied to", async () => {
    assert.equal(await applySkin("neobrutalist"), true);
    const css = adoptedCss();
    assert.ok(css.includes(skinScope("neobrutalist")), "the skin's stylesheet is in the document");
    assert.ok(css.includes("--border-width: 3px"));
    assert.ok(css.includes("--font-family-base:"), "the skin brings its face");
    assert.equal(getComputedStyle(document.documentElement).getPropertyValue("--border-width").trim(), "");
  });

  it("answers false for a name that is not a preset", async () => {
    assert.equal(await applySkin("not-a-preset"), false);
  });

  it("comes off again", () => {
    clearSkin("neobrutalist");
    assert.ok(!adoptedCss().includes(skinScope("neobrutalist")));
  });
});

describe("<showcase-catalogue>", () => {
  /** @type {CatalogueElement} */
  let el;

  before(async () => {
    define("showcase-catalogue", catalogueDef);
    el = /** @type {CatalogueElement} */ (document.createElement("showcase-catalogue"));
    document.body.appendChild(el);
    await until(() => el.querySelector(".catalogue-grid"), "the catalogue");
  });

  after(() => el.remove());

  it("draws a card per component, grouped by category", () => {
    const heads = [...el.querySelectorAll(".catalogue-category-head h2")].map((h) => h.textContent?.trim());
    assert.deepEqual(heads, CATEGORIES.map((category) => category.label));
    const cards = [...el.querySelectorAll(".catalogue-card-name code")].map((code) => code.textContent?.trim());
    const listed = browsableCategories(componentTags()).flatMap((category) => category.components);
    assert.deepEqual(cards.sort(), listed.sort());
  });

  it("filters by the search it is given", async () => {
    el.search = "but";
    await until(() => el.querySelectorAll(".catalogue-card").length === 1, "one card");
    assert.equal(el.querySelector(".catalogue-card-name code")?.textContent?.trim(), "button");
    el.search = "";
    await until(() => el.querySelectorAll(".catalogue-card").length > 1, "every card");
  });

  it("says which component was chosen instead of navigating", async () => {
    /** @type {{ category: string, name: string }[]} */
    const opened = [];
    el.addEventListener("open", (event) => opened.push(/** @type {CustomEvent<{ category: string, name: string }>} */ (event).detail));
    await until(() => el.querySelectorAll(".catalogue-card").length > 1, "every card");
    /** @type {HTMLElement} */ (el.querySelector('.catalogue-card[data-name="button"]')).click();
    assert.deepEqual(opened, [{ category: "display", name: "button" }]);
  });

  it("announces the uri when a host gives it one", () => {
    el.uri = "showcase://showcase";
    assert.equal(el.isHosted(), true);
    /** @type {string[]} */
    const uris = [];
    el.addEventListener("showcase-open", (event) => uris.push(/** @type {CustomEvent<{ uri: string }>} */ (event).detail.uri));
    el.open("display", "button");
    assert.deepEqual(uris, ["showcase://component/display/button"]);
    el.uri = "";
  });
});

describe("<showcase-component-doc>", () => {
  /** @type {DocElement} */
  let el;

  before(async () => {
    define("lc-example", exampleDef);
    define("lc-button", buttonDef);
    define("showcase-component-doc", componentDocDef);
    el = /** @type {DocElement} */ (document.createElement("showcase-component-doc"));
    el.category = "display";
    el.name = "button";
    document.body.appendChild(el);
    await until(() => (Boolean(el.selectedComponent) && Boolean(el.demo) && !el.loading) || Boolean(el.error), "the load to settle");
    assert.equal(el.error, "");
  });

  after(() => {
    el.remove();
    if (el.appliedSkin) clearSkin(el.appliedSkin);
  });

  it("draws an example per demo example", async () => {
    const demo = /** @type {{ examples: unknown[] }} */ (el.demo);
    assert.ok(demo.examples.length > 0);
    await until(() => el.querySelector("lc-example.component-doc-example"), "an example");
    assert.equal(el.querySelectorAll("lc-example.component-doc-example").length, demo.examples.length);
  });

  it("dresses the stages in the skin it is given and takes it off again", async () => {
    el.skin = "neobrutalist";
    await until(() => el.appliedSkin === "neobrutalist", "the skin to apply");
    const stage = await until(() => el.querySelector('.example-stage[data-lc-skin="neobrutalist"]'), "a stage wearing the skin");
    assert.equal(getComputedStyle(/** @type {Element} */ (stage)).getPropertyValue("--border-width").trim(), "3px");
    el.skin = "";
    await until(() => !/** @type {Element} */ (stage).hasAttribute("data-lc-skin"), "the skin to come off");
    assert.equal(getComputedStyle(/** @type {Element} */ (stage)).getPropertyValue("--border-width").trim(), "");
  });

  it("says which sibling was asked for instead of navigating", () => {
    /** @type {{ category: string, name: string }[]} */
    const opened = [];
    el.addEventListener("open", (event) => opened.push(/** @type {CustomEvent<{ category: string, name: string }>} */ (event).detail));
    el.open("layout", "card");
    assert.deepEqual(opened, [{ category: "layout", name: "card" }]);
  });
});

describe("a component's demo", () => {
  it("renders every example into a live tree", async () => {
    const demo = (await import("@lightstart/components/display/button.demo.js")).default;
    assert.ok(demo.examples.length, "the button demo has no examples");
    const host = document.createElement("div");
    document.body.appendChild(host);
    for (const example of demo.examples) {
      render(example.render(), host);
      assert.ok(host.querySelector("lc-button"), `"${example.title}" rendered no button`);
    }
    host.remove();
  });

  it("reads an example's code back off its own source", async () => {
    const demo = (await import("@lightstart/components/display/button.demo.js")).default;
    const code = codeOf(demo.examples[0]);
    assert.match(code, /^<lc-button/);
    assert.ok(!code.includes("html`"));
  });

  it("answers an empty demo for a component that has none", async () => {
    assert.deepEqual(await loadDemo("not-a-component"), { description: "", examples: [] });
  });
});
