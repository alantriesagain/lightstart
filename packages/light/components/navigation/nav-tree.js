import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { isActivePath } from "../utils/active-path.js";
import { lcText } from "../utils/text.js";
import { navigation } from "@bootstrapp/light/navigation";
/** @import { NavTreeGroup, Prop } from "../types.ts" */

const TAG = "lc-nav-tree";

/**
 * Nav Tree Component
 *
 * @component
 * @category navigation
 * @tag lc-nav-tree
 *
 * A site's sections as groups of links, from data. A group opens and closes,
 * shows its count, and folds its tail behind "+N more"; the link for the
 * current route marks itself.
 *
 * @example
 * ```html
 * <lc-nav-tree .groups=${[{ id: "form", label: "Form", icon: "list-checks", items: [{ label: "Input", href: "/components/form/input" }] }]} .open=${["form"]} collapse-at="7"></lc-nav-tree>
 * ```
 */
export default defineComponent({
  tag: "lc-nav-tree",
  icons: ["chevron-right"],
  style: true,
  props: {
    groups: /** @type {Prop<NavTreeGroup[]>} */ (T.array({ attribute: false, defaultValue: [] })),
    open: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    collapseAt: 0,
    expanded: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    active: "",
    size: T.string({ defaultValue: "sm", enum: ["sm", "md"] }),
    _path: "",
  },
  events: {
    "nav-tree-toggle": T.object(),
    "nav-tree-select": T.object(),
  },
  connected() {
    this._path = navigation.path();
    this.$own(navigation.subscribe(() => {
      this._path = navigation.path();
    }));
  },
  /** @param {string} id */
  _toggle(id) {
    const isOpen = this.open.includes(id);
    this.open = isOpen ? this.open.filter((entry) => entry !== id) : [...this.open, id];
    this.$emit("nav-tree-toggle", { id, open: !isOpen });
  },
  /** @param {string} id */
  _expand(id) {
    this.expanded = [...this.expanded, id];
  },
  /** @param {{ href: string, exact?: boolean }} item */
  _isActive(item) {
    if (this.active) return this.active === item.href;
    return isActivePath(this._path, item.href, item.exact);
  },
  /** @param {NavTreeGroup} group */
  _renderGroup(group) {
    const isOpen = this.open.includes(group.id);
    const folded = this.collapseAt > 0 && group.items.length > this.collapseAt && !this.expanded.includes(group.id);
    const shown = isOpen ? (folded ? group.items.slice(0, this.collapseAt) : group.items) : [];
    return html`
      <div class="nav-tree-group" ?data-open=${isOpen}>
        <button type="button" class="nav-tree-head" aria-expanded=${String(isOpen)} @click=${() => this._toggle(group.id)}>
          ${group.icon ? html`<lc-icon class="nav-tree-icon" name=${group.icon} size="14"></lc-icon>` : nothing}
          <span class="nav-tree-label">${group.label}</span>
          ${group.count !== undefined ? html`<span class="nav-tree-count">${group.count}</span>` : nothing}
          <lc-icon class="nav-tree-chevron" name="chevron-right" size="13"></lc-icon>
        </button>
        ${isOpen
          ? html`
              <div class="nav-tree-items">
                ${shown.map(
                  (item) => html`
                    <lc-nav-item
                      class="nav-tree-item"
                      href=${item.href}
                      label=${item.label}
                      badge=${item.badge ?? ""}
                      size=${this.size}
                      active-bg
                      ?active=${this._isActive(item)}
                      @nav-item-click=${() => this.$emit("nav-tree-select", { href: item.href })}
                    ></lc-nav-item>
                  `,
                )}
                ${folded
                  ? html`<button type="button" class="nav-tree-more" @click=${() => this._expand(group.id)}>${lcText(TAG, "more", { count: group.items.length - this.collapseAt })}</button>`
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  },
  render() {
    return html`<nav class="nav-tree" aria-label=${lcText(TAG, "nav")}>${this.groups.map((group) => this._renderGroup(group))}</nav>`;
  },
});
