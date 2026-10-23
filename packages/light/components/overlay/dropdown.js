import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { withPopover } from "@bootstrapp/light/components/mixins/popover.js";
import { nextIndex } from "../utils/roving.js";
/** @import { Prop, DropdownItem } from "../types.ts" */
/** @import { TemplateValue } from "@bootstrapp/light/html" */

export default defineComponent({
  mixins: [withPopover],
  style: true,
  tag: "lc-dropdown",
  props: {
    autoClose: true,
    items: /** @type {Prop<DropdownItem[]>} */ (T.array()),
    content: /** @type {Prop<(() => TemplateValue) | null>} */ (T.object({ attribute: false, defaultValue: null, hasChanged: () => false })),
    _slotContent: /** @type {Prop<ChildNode[] | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },

  connected() {
    this.setAttribute("role", "menu");
    if (!this._slotContent) this._slotContent = [...this.childNodes];

    const onMenuClick = /** @type {EventListener} */ ((e) => this._handleMenuClick(/** @type {MouseEvent} */ (e)));
    const onKeydown = /** @type {EventListener} */ ((e) => this._handleKeydown(/** @type {KeyboardEvent} */ (e)));
    const onOpen = () => document.addEventListener("keydown", onKeydown, true);
    const onClose = () => document.removeEventListener("keydown", onKeydown, true);

    this.addEventListener("click", onMenuClick);
    this.addEventListener("popover-open", onOpen);
    this.addEventListener("popover-close", onClose);
    this.$own(() => {
      this.removeEventListener("click", onMenuClick);
      this.removeEventListener("popover-open", onOpen);
      this.removeEventListener("popover-close", onClose);
      document.removeEventListener("keydown", onKeydown, true);
    });
  },

  _rows() {
    return /** @type {HTMLElement[]} */ ([...this.querySelectorAll("button.lc-dropdown-item:not([disabled])")]);
  },

  /** @param {KeyboardEvent} e */
  _handleKeydown(e) {
    if (!this.open) return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = this._rows();
    if (!rows.length) return;
    e.preventDefault();
    const active = document.activeElement;
    const index = active instanceof HTMLElement ? rows.indexOf(active) : -1;
    const next = nextIndex(e.key, index, rows.length, { wrap: true });
    if (next !== null) rows[next].focus();
  },

  /** @param {MouseEvent} e */
  _handleMenuClick(e) {
    if (!this.autoClose || this.items?.length) return;
    const target = /** @type {HTMLElement} */ (e.target);
    const link = target.closest("a, button");
    if (link && !link.closest("[popovertarget]"))
      this._close();
  },

  /**
   * @param {DropdownItem} item
   * @param {MouseEvent} e
   */
  _pickItem(item, e) {
    e.stopPropagation();
    if (item.disabled) return;
    item.onClick?.(e);
    if (this.autoClose && !item.keepOpen) this._close();
  },

  render() {
    if (this.content) return html`${this.content()}`;
    if (!this.items?.length) return html`${this._slotContent}`;
    const hasChecks = this.items.some((item) => item.checked !== undefined);
    return html`
      ${this.items.map((item) => {
        if (item.divider) return html`<hr />`;
        if (item.header != null) return html`<div class="dropdown-header">${item.header}</div>`;
        return html`
          <button
            class="lc-dropdown-item ${item.danger ? "is-danger" : ""}"
            role="menuitem"
            ?disabled=${item.disabled}
            @click=${(/** @type {MouseEvent} */ e) => this._pickItem(item, e)}
          >
            ${hasChecks ? html`<span class="lc-dropdown-check">${item.checked ? html`<lc-icon name="check" size="12"></lc-icon>` : ""}</span>` : ""}
            ${item.icon ? html`<lc-icon name=${item.icon} size="13"></lc-icon>` : ""}
            <span class="lc-dropdown-label">${item.label}</span>
          </button>
        `;
      })}
    `;
  },
});

/**
 * Copyright (c) Alan Carlos Meira Leal
 *
 * Dropdown Component
 * Menu popover with two content modes: a structured `items` array (rendered
 * rows with icons, check marks, group headers, dividers, danger styling and
 * keyboard navigation) or raw slotted HTML. `withPopover()` gives it
 * positioning, open state, and outside-click handling.
 *
 * @slot - Raw menu content (used only when `items` and `content` are not set)
 *
 * `content` is a render callback for a menu whose body changes while it is
 * open, which the slot cannot carry: slotted children are snapshotted once at
 * connect. It takes precedence over both other modes.
 *
 * @property {string} position - Positioning relative to trigger (inherited)
 * @property {boolean} autoClose - Close after an item click (default true; per-item `keepOpen` overrides)
 * @property {Array<object>} items - Structured rows:
 *   `{ label, icon?, onClick?, checked?, danger?, disabled?, keepOpen? }`,
 *   `{ divider: true }`, or `{ header: "Group label" }`
 *
 * Keyboard while open: Escape closes (refocuses trigger), ArrowDown/ArrowUp
 * focus the first/last row then cycle, Enter activates the focused row.
 * Mouse interaction never shows a focus ring (focus-visible only).
 *
 * @example Structured items with a programmatic trigger
 * ```js
 * html`
 *   <lc-button @click=${(e) => this.querySelector("#actions")?.toggle(e.currentTarget)}>Actions</lc-button>
 *   <lc-dropdown id="actions" bordered rounded shadow .items=${[
 *     { header: "Project" },
 *     { label: "Rename", icon: "pencil", onClick: () => this.rename() },
 *     { label: "Pinned", icon: "pin", checked: this.pinned, keepOpen: true, onClick: () => this.togglePin() },
 *     { divider: true },
 *     { label: "Delete", icon: "trash-2", danger: true, onClick: () => this.remove() },
 *   ]}></lc-dropdown>
 * `
 * ```
 *
 * @example Raw HTML mode (popovertarget trigger)
 * ```html
 * <lc-button popovertarget="menu5">Toggle Menu</lc-button>
 * <lc-dropdown id="menu5" bordered rounded shadow>
 *   <div class="dropdown-header">Settings</div>
 *   <a href="/profile">Profile</a>
 *   <hr>
 *   <a href="/logout">Logout</a>
 * </lc-dropdown>
 * ```
 */
