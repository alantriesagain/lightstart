import { defineComponent } from "@bootstrapp/light";

/** @import { TreeItemElement } from "../types.ts" */

/** @param {Element} item @returns {HTMLElement | null} the row a click on toggles or selects the item */
const contentOf = (item) => item.querySelector(":scope > [part~=lc-tree-item-item-content]");

/** @param {Element} item */
const isShown = (item) => {
  for (let parent = item.parentElement; parent && parent.tagName === "LC-TREE-ITEM"; parent = parent.parentElement)
    if (!parent.hasAttribute("expanded")) return false;
  return true;
};

export default defineComponent({
  tag: "lc-tree",
  style: true,

  _items() {
    return [.../** @type {NodeListOf<TreeItemElement>} */ (this.querySelectorAll("lc-tree-item"))].filter(isShown);
  },
  /** @param {KeyboardEvent} e */
  _keydown(e) {
    const items = this._items();
    const from = items.findIndex((item) => item === e.target);
    if (from === -1) return;
    const current = items[from];
    /** @type {HTMLElement | null} */
    let next = null;
    if (e.key === "ArrowDown") next = items[from + 1] ?? null;
    else if (e.key === "ArrowUp") next = items[from - 1] ?? null;
    else if (e.key === "Home") next = items[0];
    else if (e.key === "End") next = items[items.length - 1];
    else if (e.key === "ArrowRight")
      if (current._hasChildren() && !current.expanded) contentOf(current)?.click();
      else next = items[from + 1] ?? null;
     else if (e.key === "ArrowLeft")
      if (current._hasChildren() && current.expanded) contentOf(current)?.click();
      else next = /** @type {HTMLElement | null} */ (current.parentElement?.closest("lc-tree-item"));
     else if (e.key === "Enter" || e.key === " ") contentOf(current)?.click();
    else return;
    e.preventDefault();
    if (next) {
      current.setAttribute("tabindex", "-1");
      next.setAttribute("tabindex", "0");
      next.focus();
    }
  },
  connected() {
    this.setAttribute("role", "tree");
    const onKey = /** @type {EventListener} */ ((e) => this._keydown(/** @type {KeyboardEvent} */ (e)));
    this.addEventListener("keydown", onKey);
    this.$own(() => this.removeEventListener("keydown", onKey));
  },
  firstUpdated() {
    const first = this._items()[0];
    if (first && !this.querySelector('lc-tree-item[tabindex="0"]')) first.setAttribute("tabindex", "0");
  },
});

/**
 * Tree Component
 *
 * @component
 * @category navigation
 * @tag lc-tree
 *
 * A container for tree items. Use with lc-tree-item for nested structures.
 * Automatically shows folder/folder-open icons and depth guide lines.
 *
 * @example Basic Tree
 * ```html
 * <lc-tree>
 *   <lc-tree-item label="Folder 1">
 *     <lc-tree-item label="File 1.1" icon="file"></lc-tree-item>
 *     <lc-tree-item label="File 1.2" icon="file"></lc-tree-item>
 *   </lc-tree-item>
 *   <lc-tree-item label="Folder 2">
 *     <lc-tree-item label="Subfolder 2.1">
 *       <lc-tree-item label="File 2.1.1" icon="file"></lc-tree-item>
 *     </lc-tree-item>
 *     <lc-tree-item label="File 2.2" icon="file"></lc-tree-item>
 *   </lc-tree-item>
 * </lc-tree>
 * ```
 *
 * @example Expanded Folders
 * ```html
 * <lc-tree>
 *   <lc-tree-item label="src" expanded>
 *     <lc-tree-item label="components" expanded>
 *       <lc-tree-item label="Button.js" icon="file"></lc-tree-item>
 *       <lc-tree-item label="Input.js" icon="file"></lc-tree-item>
 *     </lc-tree-item>
 *     <lc-tree-item label="index.js" icon="file"></lc-tree-item>
 *   </lc-tree-item>
 * </lc-tree>
 * ```
 *
 * @example With Active and Modified States
 * ```html
 * <lc-tree>
 *   <lc-tree-item label="project" expanded>
 *     <lc-tree-item label="App.js" icon="file" active modified></lc-tree-item>
 *     <lc-tree-item label="index.js" icon="file"></lc-tree-item>
 *     <lc-tree-item label="config.json" icon="file" modified></lc-tree-item>
 *   </lc-tree-item>
 * </lc-tree>
 * ```
 *
 * @example File Explorer
 * ```html
 * <lc-tree>
 *   <lc-tree-item label="Documents">
 *     <lc-tree-item label="report.pdf" icon="file"></lc-tree-item>
 *     <lc-tree-item label="notes.txt" icon="file"></lc-tree-item>
 *   </lc-tree-item>
 *   <lc-tree-item label="Pictures">
 *     <lc-tree-item label="vacation" expanded>
 *       <lc-tree-item label="beach.jpg" icon="image"></lc-tree-item>
 *       <lc-tree-item label="sunset.jpg" icon="image"></lc-tree-item>
 *     </lc-tree-item>
 *   </lc-tree-item>
 *   <lc-tree-item label="Downloads">
 *     <lc-tree-item label="installer.exe" icon="file"></lc-tree-item>
 *   </lc-tree-item>
 * </lc-tree>
 * ```
 *
 * @example With Event Handlers
 * A folder emits `toggle` with its new state; a leaf emits `select` with its label.
 * Arrow keys move between visible items, Right opens, Left closes or climbs.
 * ```js
 * html`<lc-tree>
 *   <lc-tree-item
 *     label="Project Files"
 *     @toggle=${(e) => console.log('Toggled:', e.detail.expanded)}
 *     @select=${(e) => console.log('Chosen:', e.detail.label)}
 *   >
 *     <lc-tree-item label="index.html" icon="file"></lc-tree-item>
 *   </lc-tree-item>
 * </lc-tree>`
 * ```
 */
