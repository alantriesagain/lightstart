import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

export default defineComponent({
  tag: "lc-app-header",
  props: {
    title: "",
    fixed: T.boolean(),
    transparent: false,
    showBackButton: false,
    showShadow: true,
    elevation: 1,
  },
  style: true,

  handleBackClick() {
    this.$emit("back-click");
  },

  render() {
    return html`
        <div part="lc-app-header-start" class="app-header-start">
          ${
            this.showBackButton
              ? html`
                <button
                  part="lc-app-header-back-button"
                  class="back-button"
                  @click=${this.handleBackClick}
                  aria-label=${lcText("lc-app-header", "back")}
                >
                </button>
              `
              : ""
          }
          <slot name="start"></slot>
        </div>

        <div part="lc-app-header-title" class="app-header-title">
          ${this.title ? html`<h1>${this.title}</h1>` : ""}
          <slot name="title"></slot>
        </div>

        <div part="lc-app-header-end" class="app-header-end">
          <slot name="end"></slot>
        </div>
    `;
  },
});

/**
 * App Header Component
 *
 * @component
 * @category navigation
 * @tag lc-app-header
 *
 * A mobile-optimized header with back button, title, and action buttons.
 * Designed for mobile apps with support for fixed positioning and safe areas.
 *
 * @slot start - Left side content (menu button, back button, etc.)
 * @slot title - Header title content
 * @slot end - Right side content (action buttons)
 *
 * @part header - The header container
 * @part start - The start/left section
 * @part title - The title section
 * @part end - The end/right section
 * @part back-button - The back button (when showBackButton is true)
 *
 * @example Basic Header
 * ```html
 * <lc-app-header title="My App"></lc-app-header>
 * ```
 *
 * @example With Back Button
 * ```html
 * <lc-app-header
 *   title="Profile"
 *   show-back-button
 *   @back-click=${() => console.log('Back clicked')}
 * ></lc-app-header>
 * ```
 *
 * @example With Actions
 * ```html
 * <lc-app-header title="Messages">
 *   <button slot="end">
 *     <lc-icon name="search"></lc-icon>
 *   </button>
 *   <button slot="end">
 *     <lc-icon name="more-vertical"></lc-icon>
 *   </button>
 * </lc-app-header>
 * ```
 *
 * @example With Menu Button
 * ```html
 * <lc-app-header title="Dashboard">
 *   <button slot="start">
 *     <lc-icon name="menu"></lc-icon>
 *   </button>
 * </lc-app-header>
 * ```
 *
 * @example Transparent Header
 * ```html
 * <lc-app-header
 *   title="Photo"
 *   transparent
 *   show-back-button
 * ></lc-app-header>
 * ```
 *
 * @example Custom Title Content
 * ```html
 * <lc-app-header>
 *   <div slot="title">
 *     <img src="/logo.svg" alt="Logo" height="32">
 *   </div>
 * </lc-app-header>
 * ```
 *
 * @example Non-Fixed Header
 * ```html
 * <lc-app-header title="About" fixed="false"></lc-app-header>
 * ```
 *
 * @example Without Shadow
 * ```html
 * <lc-app-header
 *   title="Settings"
 *   show-shadow="false"
 * ></lc-app-header>
 * ```
 */
