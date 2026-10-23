import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { withClickOutside } from "@bootstrapp/light/components/mixins/click-outside.js";
import { withPopover } from "@bootstrapp/light/components/mixins/popover.js";
import { env } from "@bootstrapp/light/env";

/** @import { ContextMenuItem, Prop } from "../types.ts" */

const SUBMENU_LINGER_MS = 150;

/**
 * A trigger the popover can anchor to when what opened the menu is a point,
 * not an element.
 * @param {number} x @param {number} y
 */
const pointTrigger = (x, y) => /** @type {Element} */ (/** @type {unknown} */ ({
  getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }),
}));

export default defineComponent({
  mixins: [withPopover, withClickOutside({ events: ["contextmenu"] })],
  tag: "lc-context-menu",
  style: true,
  props: {
    items: /** @type {Prop<ContextMenuItem[]>} */ (T.array({ defaultValue: [] })),
    target: T.any(null),
    offset: 0,
    position: "bottom-left",
    _openSubmenu: /** @type {Prop<string | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _closeTimer: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },
  events: {
    select: T.object({ item: T.object(), target: T.any() }),
  },

  connected() {
    this.setAttribute("role", "menu");
    this.$own(() => clearTimeout(this._closeTimer ?? undefined));
  },

  /**
   * Open at a point, as a right-click does.
   * @param {number} x @param {number} y
   * @param {{ items?: ContextMenuItem[], target?: unknown }} [opts]
   */
  openAt(x, y, { items, target } = {}) {
    if (items) this.items = items;
    if (target !== undefined) this.target = target;
    this._close();
    this.position = "bottom-left";
    this._open(pointTrigger(x, y));
    this._settle();
  },

  /**
   * Open beside an element, as a kebab button does.
   * @param {Element} anchor
   * @param {{ items?: ContextMenuItem[], target?: unknown, position?: string }} [opts]
   */
  openFor(anchor, { items, target, position = "bottom-left" } = {}) {
    if (items) this.items = items;
    if (target !== undefined) this.target = target;
    this._close();
    this.position = position;
    this._open(anchor);
    this._settle();
  },

  _settle() {
    Promise.resolve(this.$requestUpdate?.()).then(() => this._updatePosition());
  },

  /** @param {ContextMenuItem} item */
  _pick(item) {
    if (item.children || item.disabled) return;
    item.action?.(this.target);
    this.$emit("select", { item, target: this.target });
    this._close();
  },

  /** @param {string | undefined} label @param {HTMLElement} li */
  _showSubmenu(label, li) {
    clearTimeout(this._closeTimer ?? undefined);
    this._openSubmenu = label ?? null;
    for (const panel of /** @type {NodeListOf<HTMLElement>} */ (this.querySelectorAll(".lc-context-menu-submenu"))) panel.style.display = "none";
    const panel = /** @type {HTMLElement | null} */ (li.querySelector(".lc-context-menu-submenu"));
    if (!panel) return;
    panel.style.display = "block";
    requestAnimationFrame(() => {
      const rect = panel.getBoundingClientRect();
      if (rect.right > env.width) {
        panel.style.left = "auto";
        panel.style.right = "100%";
      }
      if (rect.bottom > env.height) {
        panel.style.top = "auto";
        panel.style.bottom = "0";
      }
    });
  },

  /** @param {HTMLElement} li */
  _hideSubmenu(li) {
    this._closeTimer = setTimeout(() => {
      this._openSubmenu = null;
      const panel = /** @type {HTMLElement | null} */ (li.querySelector(".lc-context-menu-submenu"));
      if (panel) panel.style.display = "none";
    }, SUBMENU_LINGER_MS);
  },

  /** @param {ContextMenuItem} item */
  _renderLeaf(item) {
    return html`
      <li role="menuitem" class="${item.danger ? "is-danger" : ""}">
        <a
          class="lc-context-menu-row"
          aria-disabled=${item.disabled ? "true" : "false"}
          @click=${(/** @type {Event} */ e) => {
            e.preventDefault();
            this._pick(item);
          }}
        >
          ${item.icon ? html`<lc-icon name=${item.icon} size="14" class="lc-context-menu-icon"></lc-icon>` : ""}
          <span class="lc-context-menu-label">${item.label}</span>
          ${item.keybinding ? html`<span class="lc-context-menu-key">${item.keybinding}</span>` : ""}
        </a>
      </li>
    `;
  },

  /** @param {ContextMenuItem} item @param {ContextMenuItem[]} children */
  _renderParent(item, children) {
    return html`
      <li
        role="menuitem"
        class="lc-context-menu-parent"
        @mouseenter=${(/** @type {MouseEvent & { currentTarget: HTMLElement }} */ e) => this._showSubmenu(item.label, e.currentTarget)}
        @mouseleave=${(/** @type {MouseEvent & { currentTarget: HTMLElement }} */ e) => this._hideSubmenu(e.currentTarget)}
      >
        <a class="lc-context-menu-row">
          ${item.icon ? html`<lc-icon name=${item.icon} size="14" class="lc-context-menu-icon"></lc-icon>` : ""}
          <span class="lc-context-menu-label">${item.label}</span>
          <lc-icon name="chevron-right" size="12" class="lc-context-menu-chevron"></lc-icon>
        </a>
        <div class="lc-context-menu-submenu">
          <lc-menu size="sm">${children.map((child) => (child.separator ? html`<li role="separator"></li>` : this._renderLeaf(child)))}</lc-menu>
        </div>
      </li>
    `;
  },

  render() {
    /** @type {Map<string, ContextMenuItem[]>} */
    const groups = new Map();
    for (const item of this.items) {
      const group = item.group || "default";
      groups.set(group, [...(groups.get(group) || []), item]);
    }
    const ordered = [...groups.keys()].sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b)));
    return html`
      <lc-menu size="sm">
        ${ordered.map((group, index) => html`
          ${index > 0 ? html`<li role="separator"></li>` : ""}
          ${(groups.get(group) || []).map((item) => (item.separator ? html`<li role="separator"></li>` : item.children ? this._renderParent(item, item.children) : this._renderLeaf(item)))}
        `)}
      </lc-menu>
    `;
  },
});

/**
 * Context Menu Component
 *
 * @component
 * @category overlay
 * @tag lc-context-menu
 *
 * A menu of actions for a spot: opened at a point by a right-click, or beside
 * an element by a kebab button. Items carry a label, an icon, a keybinding
 * hint, a group (groups are separated and sorted by name), children for a
 * submenu, and an `action(target)`; picking one runs its action, emits
 * `select` and closes the menu. Escape, an outside click and an outside
 * right-click close it too.
 *
 * @example Opened at a point
 * ```html
 * <div @contextmenu=${(e) => { e.preventDefault(); menu.openAt(e.clientX, e.clientY, { items, target: row }); }}>Right-click me</div>
 * <lc-context-menu id="menu"></lc-context-menu>
 * ```
 *
 * @example Opened beside a button
 * ```html
 * <lc-button icon="ellipsis" iconOnly @click=${(e) => menu.openFor(e.currentTarget, { items, position: "bottom-right" })}></lc-button>
 * ```
 */
