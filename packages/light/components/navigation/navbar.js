import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

export default defineComponent({
  tag: "lc-navbar",
  props: {
    fixed: T.string({
      defaultValue: "none",
      enum: ["none", "top", "bottom"],
    }),
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "bordered", "floating"],
    }),
    transparent: false,
    mobileMenuOpen: false,
    collapsed: false,
    collapsible: false,
    direction: T.string({
      enum: ["vertical", "horizontal"],
      defaultValue: "horizontal",
    }),
  },
  style: true,

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.$emit("menu-toggle", { open: this.mobileMenuOpen });
  },

  toggle() {
    if (this.collapsible) {
      this.collapsed = !this.collapsed;
      this.$emit("navbar-toggle", { collapsed: this.collapsed });
    }
  },

  render() {
    return html`
      <nav part="lc-navbar-container" class="navbar ${this.mobileMenuOpen ? "menu-open" : ""}" role="navigation" direction=${this.direction}>
        <div part="lc-navbar-inner" class="navbar-container" direction=${this.direction}>
          <div part="lc-navbar-brand" class="navbar-brand">
            <slot name="brand"></slot>
          </div>

          <button
            part="lc-navbar-toggle"
            class="navbar-toggle"
            @click=${this.toggleMobileMenu}
            aria-label=${lcText("lc-navbar", "toggle")}
            aria-expanded=${this.mobileMenuOpen}
          >
            <lc-icon name=${this.mobileMenuOpen ? "x" : "menu"}></lc-icon>
          </button>
          <div part="lc-navbar-menu" class="navbar-menu ${this.mobileMenuOpen ? "active" : ""}" direction=${this.direction} justify="space-between">
            <div part="lc-navbar-start" class="navbar-start">
              <slot name="start"></slot>
            </div>
            <div part="lc-navbar-center" class="navbar-center">
              <slot name="center"></slot>
            </div>
            <div part="lc-navbar-end" class="navbar-end">
              <slot name="end"></slot>
            </div>
          </div>
        </div>
      </nav>
    `;
  },
});

/**
 * Navbar Component
 *
 * @component
 * @category navigation
 * @tag lc-navbar
 *
 * A responsive navigation bar with support for branding, links, and actions.
 *
 * @slot brand - Logo or brand content (left side on desktop)
 * @slot start - Navigation items (left side after brand on desktop)
 * @slot center - Centered navigation items
 * @slot end - Navigation items (right side on desktop)
 *
 * @example
 * // Basic navbar
 * ```html
 * <lc-navbar>
 *   <div slot="brand">
 *     <strong>MyApp</strong>
 *   </div>
 *   <div slot="start">
 *     <a href="#home">Home</a>
 *     <a href="#about">About</a>
 *     <a href="#services">Services</a>
 *   </div>
 *   <div slot="end">
 *     <lc-button variant="primary" size="sm">Sign Up</lc-button>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // With logo
 * ```html
 * <lc-navbar>
 *   <div slot="brand">
 *     <img src="/logo.svg" alt="Logo" style="height: 2rem;">
 *   </div>
 *   <div slot="start">
 *     <a href="#products">Products</a>
 *     <a href="#pricing">Pricing</a>
 *     <a href="#docs">Docs</a>
 *   </div>
 *   <div slot="end">
 *     <a href="#login">Login</a>
 *     <lc-button variant="primary">Get Started</lc-button>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // Fixed to top
 * ```html
 * <lc-navbar fixed="top">
 *   <div slot="brand">
 *     <strong>Fixed Top</strong>
 *   </div>
 *   <div slot="center">
 *     <a href="#home">Home</a>
 *     <a href="#features">Features</a>
 *     <a href="#contact">Contact</a>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // Fixed to bottom
 * ```html
 * <lc-navbar fixed="bottom">
 *   <div slot="center">
 *     <a href="#home"><lc-icon name="house"></lc-icon> Home</a>
 *     <a href="#search"><lc-icon name="search"></lc-icon> Search</a>
 *     <a href="#profile"><lc-icon name="user"></lc-icon> Profile</a>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // Bordered variant
 * ```html
 * <lc-navbar variant="bordered">
 *   <div slot="brand">MyApp</div>
 *   <div slot="start">
 *     <a href="#dashboard">Dashboard</a>
 *     <a href="#projects">Projects</a>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // Floating variant
 * ```html
 * <lc-navbar variant="floating">
 *   <div slot="brand">MyApp</div>
 *   <div slot="center">
 *     <a href="#home">Home</a>
 *     <a href="#about">About</a>
 *     <a href="#contact">Contact</a>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // Transparent navbar
 * ```html
 * <lc-navbar transparent>
 *   <div slot="brand" style="color: white;">
 *     <strong>Transparent Nav</strong>
 *   </div>
 *   <div slot="end">
 *     <lc-button ghost>Login</lc-button>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // With dropdown menu
 * ```html
 * <lc-navbar>
 *   <div slot="brand">MyApp</div>
 *   <div slot="start">
 *     <a href="#home">Home</a>
 *     <lc-button popovertarget="products-menu">
 *       Products <lc-icon name="chevron-down"></lc-icon>
 *     </lc-button>
 *     <lc-dropdown id="products-menu">
 *       <a href="#product1">Product 1</a>
 *       <a href="#product2">Product 2</a>
 *       <a href="#product3">Product 3</a>
 *     </lc-dropdown>
 *   </div>
 *   <div slot="end">
 *     <lc-avatar popovertarget="user-menu" size="sm" initials="JD"></lc-avatar>
 *     <lc-dropdown id="user-menu">
 *       <a href="#profile">Profile</a>
 *       <a href="#settings">Settings</a>
 *       <a href="#logout">Logout</a>
 *     </lc-dropdown>
 *   </div>
 * </lc-navbar>
 * ```
 *
 * @example
 * // With search
 * ```html
 * <lc-navbar>
 *   <div slot="brand">MyApp</div>
 *   <div slot="center">
 *     <lc-input
 *       type="search"
 *       placeholder="Search..."
 *       size="sm"
 *       style="width: 300px;"
 *     ></lc-input>
 *   </div>
 *   <div slot="end">
 *     <lc-button ghost size="sm">
 *       <lc-icon name="bell"></lc-icon>
 *     </lc-button>
 *   </div>
 * </lc-navbar>
 * ```
 */
