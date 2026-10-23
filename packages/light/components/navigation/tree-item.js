import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

const isGlyph = (/** @type {string} */ value) => /[^\x00-\x7F]/.test(value);

export default defineComponent({
  tag: "lc-tree-item",
  props: {
    label: "",
    icon: "",
    expanded: T.boolean(),
    active: false,
    modified: false,
  },
  events: {
    toggle: T.object(),
    select: T.object(),
  },
  icons: ["folder", "folder-open"],
  style: true,

  _hasChildren() {
    const slot = this.querySelector(":scope > [part~=lc-tree-item-children] > slot");
    return [...(slot ? slot.children : this.children)].some((child) => child.tagName === "LC-TREE-ITEM");
  },
  /** @param {Event} e */
  _activate(e) {
    if (/** @type {HTMLElement} */ (e.target).closest("[slot=actions]")) return;
    if (this._hasChildren()) {
      this.expanded = !this.expanded;
      this.$emit("toggle", { expanded: this.expanded });
    } else this.$emit("select", { label: this.label });
  },
  _reflect() {
    this.setAttribute("role", "treeitem");
    if (this._hasChildren()) this.setAttribute("aria-expanded", String(Boolean(this.expanded)));
    else this.removeAttribute("aria-expanded");
    this.setAttribute("aria-selected", String(Boolean(this.active)));
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "-1");
  },
  firstUpdated() {
    this._reflect();
  },
  updated() {
    this._reflect();
  },

  render() {
    const displayIcon = this.icon || (this.expanded ? "folder-open" : "folder");
    return html`
      <div part="lc-tree-item-item-content" class="item-content" @click=${this._activate}>
        ${!displayIcon ? "" : isGlyph(displayIcon) ? html`<span class="glyph">${displayIcon}</span>` : html`<lc-icon name="${displayIcon}"></lc-icon>`}
        <span class="label">${this.label}</span>
        ${this.modified ? html`<span class="modified"></span>` : ""}
        <span class="actions"><slot name="actions"></slot></span>
      </div>
      <div part="lc-tree-item-children" class="children">
        <slot></slot>
      </div>
    `;
  },
});

/**
 * Tree Item Component
 *
 * @component
 * @category navigation
 * @tag lc-tree-item
 *
 * Individual tree item. Can be nested for hierarchical structures.
 *
 * @example Basic Item
 * ```html
 * <lc-tree-item label="File" icon="file"></lc-tree-item>
 * ```
 *
 * @example With Children
 * ```html
 * <lc-tree-item label="Folder" icon="folder" expanded>
 *   <lc-tree-item label="Nested File" icon="file"></lc-tree-item>
 * </lc-tree-item>
 * ```
 *
 * @example Emoji Icon
 * ```html
 * <lc-tree-item label="Trips" icon="🧳"></lc-tree-item>
 * ```
 *
 * @example Active and Modified
 * ```html
 * <lc-tree-item label="App.js" icon="file" active modified></lc-tree-item>
 * ```
 */
