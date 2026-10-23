/**
 * `<lc-tree-item>` answers a click: a folder toggles and emits `toggle`, a
 * leaf emits `select`; the tree moves focus with the arrow keys and opens a
 * folder with Right.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import treeDef from "@bootstrapp/light/components/navigation/tree.js";
import treeItemDef from "@bootstrapp/light/components/navigation/tree-item.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();
const content = (item) => item.querySelector(":scope > [part~=lc-tree-item-item-content]");

describe("lc-tree and lc-tree-item", () => {
  /** @type {any} */
  let tree;
  /** @type {any[]} */
  const events = [];

  before(async () => {
    define("lc-tree-item", treeItemDef);
    define("lc-tree", treeDef);
    tree = document.createElement("lc-tree");
    tree.innerHTML = `
      <lc-tree-item label="src">
        <lc-tree-item label="index.js" icon="file"></lc-tree-item>
      </lc-tree-item>
      <lc-tree-item label="README.md" icon="file"></lc-tree-item>
    `;
    document.body.appendChild(tree);
    await rendered(tree);
    for (const item of tree.querySelectorAll("lc-tree-item")) {
      item.addEventListener("toggle", (e) => events.push(["toggle", e.detail.expanded]));
      item.addEventListener("select", (e) => events.push(["select", e.detail.label]));
      await rendered(item);
    }
  });

  after(() => tree.remove());

  it("names its roles", () => {
    assert.equal(tree.getAttribute("role"), "tree");
    const [folder, , leaf] = tree.querySelectorAll("lc-tree-item");
    assert.equal(folder.getAttribute("role"), "treeitem");
    assert.equal(folder.getAttribute("aria-expanded"), "false");
    assert.equal(leaf.hasAttribute("aria-expanded"), false);
  });

  it("a click opens a folder and says so", async () => {
    const [folder] = tree.querySelectorAll("lc-tree-item");
    content(folder).click();
    await rendered(folder);
    assert.equal(folder.expanded, true);
    assert.equal(folder.getAttribute("aria-expanded"), "true");
    assert.deepEqual(events.at(-1), ["toggle", true]);
  });

  it("a click on a leaf selects it", async () => {
    const leaf = tree.querySelector('lc-tree-item[label="README.md"]');
    content(leaf).click();
    assert.deepEqual(events.at(-1), ["select", "README.md"]);
  });

  it("the arrow keys move focus among visible items and Left climbs", async () => {
    const [folder, child, leaf] = tree.querySelectorAll("lc-tree-item");
    folder.focus();
    folder.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    assert.equal(document.activeElement, child, "Down moves into the open folder");
    child.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    assert.equal(document.activeElement, folder, "Left on a leaf climbs to its folder");
    folder.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    assert.equal(document.activeElement, leaf, "End reaches the last visible item");
  });
});
