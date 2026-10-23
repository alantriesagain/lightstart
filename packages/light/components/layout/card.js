import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { navigation } from "@bootstrapp/light/navigation";
export default defineComponent({
  tag: "lc-card",
  extends: "lc-container",
  style: true,
  props: {
    padding: T.string({
      defaultValue: "sm",
      enum: ["none", "xs", "sm", "md", "lg"],
    }),
    borderWidth: T.string({
      defaultValue: "1",
      enum: ["none", "0", "1", "2", "3"],
    }),
    borderStyle: T.string({
      defaultValue: "solid",
      enum: ["solid", "dashed", "dotted"],
    }),
    shadow: T.string({
      defaultValue: "none",
      enum: ["none", "sm", "md", "lg"],
    }),
    hover: false,
    gap: T.string({
      defaultValue: "md",
      enum: ["none", "xs", "sm", "md", "lg", "xl"],
    }),
    href: "",
    icon: T.string(),
    heading: T.string(),
    ariaLabel: T.string(),
  },

  /** @param {MouseEvent} e */
  _click(e) {
    if (!this.href) return;
    const path = e.composedPath();
    const link = this.querySelector(":scope > a[part~=lc-card-link]");
    const stop = link ? path.indexOf(link) : -1;
    const inner = path.slice(0, stop === -1 ? path.length : stop).some((el) =>
      el instanceof Element && el.matches("button, a[href], lc-button, input, select, textarea, label, [role=button]"));
    if (inner) return void e.preventDefault();
    navigation.click(e);
  },

  render() {
    const body = html`
      ${
        this.heading || this.icon
          ? html`<div part="lc-card-header lc-card-header-row">
              ${this.icon ? html`<span part="lc-card-icon"><lc-icon name=${this.icon} size="14"></lc-icon></span>` : nothing}
              ${this.heading ? html`<span part="lc-card-heading">${this.heading}</span>` : nothing}
              <span part="lc-card-header-spacer"></span>
              <div part="lc-card-actions"><slot name="actions"></slot></div>
            </div>`
          : html`<slot name="header" part="lc-card-header"></slot>`
      }
      <slot part="lc-card-body"><slot></slot></slot>

      <slot part="lc-card-footer" name="footer"></slot>
    `;
    return this.href
      ? html`<a part="lc-card-link" href=${navigation.href(this.href)} aria-label=${this.ariaLabel || nothing} @click=${(/** @type {MouseEvent} */ e) => this._click(e)}>${body}</a>`
      : body;
  },
});

/**
 * Copyright (c) Alan Carlos Meira Leal
 *
 * Card Component
 *
 * @component
 * @category layout
 * @tag lc-card
 *
 * A versatile container component for displaying grouped content with optional
 * header and footer sections. Supports different variants and padding options.
 *
 * @slot header - Optional header content, when neither `heading` nor `icon` is set
 * @slot actions - Right end of the header row drawn by `heading` or `icon`
 * @slot - Default slot for card body content
 * @slot footer - Optional footer content
 * @part header - The card header container
 * @part body - The card body container
 * @part footer - The card footer container
 * @part header-row - The header row drawn when `heading` or `icon` is set (also part `header`)
 * @part icon - The soft square around the icon
 * @part heading - The heading text
 * @part actions - The wrapper around the actions slot
 *
 * @example Basic Card
 * ```html
 * <lc-card>
 *   <h3 slot="header">Card Title</h3>
 *   <p>Card content goes here...</p>
 * </lc-card>
 * ```
 *
 * @example Card with Footer
 * ```html
 * <lc-card>
 *   <header slot="header"><h3 class="flex">User Profile</h3></header>
 *   <article>
 *     <p>John Doe</p>
 *     <p>Software Engineer</p>
 *   </article>
 *   <footer slot="footer">
 *     <lc-button primary>Edit</lc-button>
 *     <lc-button>Cancel</lc-button>
 *   </footer>
 * </lc-card>
 * ```
 *
 * @example Card Variants
 * ```html
 * <div class="flex flex-row gap-2">
 *  <lc-card variant="default">Default Card</lc-card>
 *  <lc-card variant="elevated">Elevated Card</lc-card>
 * </div>
 * ```
 *
 * @example Card Padding Options
 * ```html
 * <div class="flex flex-row gap-2">
 *  <lc-card padding="none">No Padding</lc-card>
 *  <lc-card padding="sm">Small Padding</lc-card>
 *  <lc-card padding="md">Medium Padding</lc-card>
 *  <lc-card padding="lg">Large Padding</lc-card>
 * </div>
 * ```
 */
