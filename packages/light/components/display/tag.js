import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

export default defineComponent({
  tag: "lc-tag",
  props: {
    variant: T.string({
      defaultValue: "default",
      enum: [
        "default",
        "primary",
        "secondary",
        "success",
        "warning",
        "error",
        "info",
      ],
    }),
    size: T.string({
      defaultValue: "md",
      enum: ["xs", "sm", "md", "lg"],
    }),
    count: T.number({ defaultValue: null }),
    outlined: false,
    rounded: true,
    closable: false,
    clickable: false,
    selected: false,
    disabled: false,
  },
  style: true,

  /** @param {Event} e */
  handleClose(e) {
    e.stopPropagation();
    if (!this.disabled)
      this.$emit("close");

  },

  /** @param {MouseEvent} e */
  handleClick(e) {
    if (this.disabled || !this.clickable) return;
    e.stopPropagation();
    this.$emit("click", e);
  },

  render() {
    return html`
      <span
        part="lc-tag-container"
        class="tag ${this.outlined ? "outlined" : ""} ${this.rounded ? "rounded" : ""}"
        ?disabled=${this.disabled}
        @click=${this.handleClick}
      >
        <slot name="icon"></slot>
        <span part="lc-tag-label" class="tag-label">
          <slot></slot>
        </span>
        ${this.count != null ? html`<span part="lc-tag-count" class="tag-count">${this.count}</span>` : ""}
        ${
          this.closable
            ? html`
              <button
                part="lc-tag-close"
                class="tag-close"
                @click=${this.handleClose}
                ?disabled=${this.disabled}
                aria-label=${lcText("lc-tag", "remove")}
              >
                <lc-icon name="x" size="xs"></lc-icon>
              </button>
            `
            : ""
        }
      </span>
    `;
  },
});

/**
 * Tag Component
 *
 * @component
 * @category display
 * @tag lc-tag
 *
 * Tags/chips for labels, categories, filters, or any metadata display.
 *
 * @slot icon - Icon to display before the tag label
 * @slot default - Tag label content
 *
 * @example
 * // Basic tags
 * ```html
 * <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
 *   <lc-tag>Default</lc-tag>
 *   <lc-tag variant="primary">Primary</lc-tag>
 *   <lc-tag variant="secondary">Secondary</lc-tag>
 *   <lc-tag variant="success">Success</lc-tag>
 *   <lc-tag variant="warning">Warning</lc-tag>
 *   <lc-tag variant="error">Error</lc-tag>
 *   <lc-tag variant="info">Info</lc-tag>
 * </div>
 * ```
 *
 * @example
 * // Outlined tags
 * ```html
 * <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
 *   <lc-tag outlined>Default</lc-tag>
 *   <lc-tag variant="primary" outlined>Primary</lc-tag>
 *   <lc-tag variant="success" outlined>Success</lc-tag>
 *   <lc-tag variant="error" outlined>Error</lc-tag>
 * </div>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; gap: 0.5rem; align-items: center;">
 *   <lc-tag size="sm" variant="primary">Small</lc-tag>
 *   <lc-tag size="md" variant="primary">Medium</lc-tag>
 *   <lc-tag size="lg" variant="primary">Large</lc-tag>
 * </div>
 * ```
 *
 * @example
 * // With counts
 * ```html
 * <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
 *   <lc-tag count="12">javascript</lc-tag>
 *   <lc-tag variant="primary" count="3">frameworks</lc-tag>
 *   <lc-tag outlined count="47">notes</lc-tag>
 * </div>
 * ```
 *
 * @example
 * // Closable tags
 * ```html
 * <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
 *   <lc-tag closable variant="primary">React</lc-tag>
 *   <lc-tag closable variant="secondary">Vue</lc-tag>
 *   <lc-tag closable variant="success">Svelte</lc-tag>
 * </div>
 * ```
 *
 * @example
 * // With icons
 * ```html
 * <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
 *   <lc-tag variant="primary">
 *     <lc-icon name="tag" slot="icon"></lc-icon>
 *     Label
 *   </lc-tag>
 *   <lc-tag variant="success">
 *     <lc-icon name="check" slot="icon"></lc-icon>
 *     Verified
 *   </lc-tag>
 *   <lc-tag variant="warning">
 *     <lc-icon name="triangle-alert" slot="icon"></lc-icon>
 *     Warning
 *   </lc-tag>
 * </div>
 * ```
 *
 * @example
 * // Not rounded
 * ```html
 * <div style="display: flex; gap: 0.5rem;">
 *   <lc-tag variant="primary" rounded="false">Square Tag</lc-tag>
 *   <lc-tag variant="success" rounded="false" outlined>Outlined Square</lc-tag>
 * </div>
 * ```
 *
 * @example
 * // Product tags
 * ```html
 * <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
 *   <h3>Wireless Headphones</h3>
 *   <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
 *     <lc-tag variant="success" size="sm">
 *       <lc-icon name="check" slot="icon"></lc-icon>
 *       In Stock
 *     </lc-tag>
 *     <lc-tag variant="error" size="sm">Hot</lc-tag>
 *     <lc-tag variant="info" size="sm">Free Shipping</lc-tag>
 *     <lc-tag size="sm" outlined>Electronics</lc-tag>
 *   </div>
 * </div>
 * ```
 *
 * @example
 * // User skills
 * ```html
 * <div>
 *   <h4>Skills:</h4>
 *   <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
 *     <lc-tag closable>JavaScript</lc-tag>
 *     <lc-tag closable>TypeScript</lc-tag>
 *     <lc-tag closable>React</lc-tag>
 *     <lc-tag closable>Node.js</lc-tag>
 *     <lc-tag closable>Python</lc-tag>
 *   </div>
 * </div>
 * ```
 *
 * @example
 * // Filter tags
 * ```html
 * <div>
 *   <h4>Active Filters:</h4>
 *   <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
 *     <lc-tag closable variant="primary" size="sm">Category: Books</lc-tag>
 *     <lc-tag closable variant="primary" size="sm">Price: $10-$50</lc-tag>
 *     <lc-tag closable variant="primary" size="sm">Rating: 4+</lc-tag>
 *   </div>
 * </div>
 * ```
 *
 * @example
 * // Status badges
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <div style="display: flex; justify-content: space-between; align-items: center;">
 *     <span>Order #12345</span>
 *     <lc-tag variant="success" size="sm">Delivered</lc-tag>
 *   </div>
 *   <div style="display: flex; justify-content: space-between; align-items: center;">
 *     <span>Order #12346</span>
 *     <lc-tag variant="info" size="sm">Processing</lc-tag>
 *   </div>
 *   <div style="display: flex; justify-content: space-between; align-items: center;">
 *     <span>Order #12347</span>
 *     <lc-tag variant="error" size="sm">Cancelled</lc-tag>
 *   </div>
 * </div>
 * ```
 *
 * @example
 * // With close event handling
 * ```js
 * html`<lc-tag
 *   closable
 *   variant="primary"
 *   @close=${() => {
 *     console.log('Tag closed');
 *     // Remove tag from list
 *   }}
 * >Removable Tag</lc-tag>`
 * ```
 *
 * @example
 * // Disabled state
 * ```html
 * <div style="display: flex; gap: 0.5rem;">
 *   <lc-tag disabled>Disabled</lc-tag>
 *   <lc-tag closable disabled variant="primary">Disabled Closable</lc-tag>
 * </div>
 * ```
 */
