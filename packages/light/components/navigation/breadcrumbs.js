import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

/** @import { Prop, BreadcrumbItem } from "../types.ts" */

export default defineComponent({
  tag: "lc-breadcrumbs",
  props: {
    separator: T.string({
      defaultValue: "/",
      enum: ["/", ">", "→", "·", "|"],
    }),
    size: T.string({
      defaultValue: "md",
      enum: ["sm", "md", "lg"],
    }),
    items: /** @type {Prop<BreadcrumbItem[]>} */ (T.array([])),
  },
  style: true,

  connected() {
    this._parseItems();
  },

  updated() {
    this._parseItems();
  },

  _parseItems() {

    if (this.items.length === 0) {
      const itemElements = Array.from(
        this.querySelectorAll(":scope > a, :scope > span"),
      );
      if (itemElements.length > 0) {
        this.items = itemElements.map((item, index) => ({
          text: item.textContent,
          href: item.getAttribute("href"),
          isLast: index === itemElements.length - 1,
        }));

        itemElements.forEach((el) => el.remove());
      }
    }
  },

  render() {
    return html`
      <nav part="lc-breadcrumbs-container" class="breadcrumbs" aria-label=${lcText("lc-breadcrumbs", "nav")}>
        <ol part="lc-breadcrumbs-list" class="breadcrumbs-list">
          ${this.items.map(
            (item, index) => html`
              <li class="breadcrumbs-item">
                ${
                  item.href
                    ? html`<lc-link href=${item.href}>${item.text}</lc-link>`
                    : html`<span class="current">${item.text}</span>`
                }
                ${
                  index < this.items.length - 1
                    ? html`<span class="separator">${this.separator}</span>`
                    : ""
                }
              </li>
            `,
          )}
        </ol>
      </nav>
    `;
  },
});

/**
 * Breadcrumbs Component
 *
 * @component
 * @category navigation
 * @tag lc-breadcrumbs
 *
 * Breadcrumb navigation showing the current page's location within the site hierarchy.
 *
 * @example
 * // Basic breadcrumbs
 * ```html
 * <lc-breadcrumbs>
 *   <a href="/">Home</a>
 *   <a href="/products">Products</a>
 *   <span>Laptop</span>
 * </lc-breadcrumbs>
 * ```
 *
 * @example
 * // Different separators
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-breadcrumbs separator="/">
 *     <a href="/">Home</a>
 *     <a href="/docs">Docs</a>
 *     <span>Components</span>
 *   </lc-breadcrumbs>
 *
 *   <lc-breadcrumbs separator=">">
 *     <a href="/">Home</a>
 *     <a href="/docs">Docs</a>
 *     <span>Components</span>
 *   </lc-breadcrumbs>
 *
 *   <lc-breadcrumbs separator="→">
 *     <a href="/">Home</a>
 *     <a href="/docs">Docs</a>
 *     <span>Components</span>
 *   </lc-breadcrumbs>
 *
 *   <lc-breadcrumbs separator="·">
 *     <a href="/">Home</a>
 *     <a href="/docs">Docs</a>
 *     <span>Components</span>
 *   </lc-breadcrumbs>
 * </div>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-breadcrumbs size="sm">
 *     <a href="/">Home</a>
 *     <a href="/products">Products</a>
 *     <span>Item</span>
 *   </lc-breadcrumbs>
 *
 *   <lc-breadcrumbs size="md">
 *     <a href="/">Home</a>
 *     <a href="/products">Products</a>
 *     <span>Item</span>
 *   </lc-breadcrumbs>
 *
 *   <lc-breadcrumbs size="lg">
 *     <a href="/">Home</a>
 *     <a href="/products">Products</a>
 *     <span>Item</span>
 *   </lc-breadcrumbs>
 * </div>
 * ```
 *
 * @example
 * // With icons
 * ```html
 * <lc-breadcrumbs>
 *   <a href="/">
 *     <lc-icon name="house"></lc-icon>
 *     Home
 *   </a>
 *   <a href="/settings">
 *     <lc-icon name="settings"></lc-icon>
 *     Settings
 *   </a>
 *   <span>
 *     <lc-icon name="user"></lc-icon>
 *     Profile
 *   </span>
 * </lc-breadcrumbs>
 * ```
 *
 * @example
 * // Deep navigation
 * ```html
 * <lc-breadcrumbs>
 *   <a href="/">Home</a>
 *   <a href="/docs">Documentation</a>
 *   <a href="/docs/components">Components</a>
 *   <a href="/docs/components/navigation">Navigation</a>
 *   <span>Breadcrumbs</span>
 * </lc-breadcrumbs>
 * ```
 */
