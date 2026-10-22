import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import {
  BREAKPOINTS,
  breakpointWidth,
  matchesBreakpoint,
} from "../utils/breakpoints.js";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";
import { env } from "@bootstrapp/light/env";
import { navigation } from "@bootstrapp/light/navigation";

const TAG = "lc-app-shell";

export default defineComponent({
  tag: "lc-app-shell",
  icons: ["menu"],
  props: {
    layout: T.string({
      defaultValue: "auto",
      enum: ["auto", "mobile", "desktop"],
    }),
    breakpoint: "md",
    asideBreakpoint: "xl",
    navWidth: "16rem",
    asideWidth: "14rem",
    headerHeight: "3.5rem",
    navOpen: false,
    isMobile: T.boolean({ defaultValue: false, internal: true }),
    isWide: T.boolean({ defaultValue: true, internal: true }),
  },
  events: {
    "nav-toggle": T.object(),
    "layout-change": T.object(),
  },
  style: true,

  /** @param {string} name */
  _hasSlot(name) {
    return this.querySelector(`[slot="${name}"]`) !== null;
  },
  /** @param {boolean} open */
  _setNav(open) {
    if (this.navOpen === open) return;
    this.navOpen = open;
    this.$emit("nav-toggle", { open });
  },

  connected() {
    this.isMobile = this._checkMobile(env.breakpoint);
    this.isWide = matchesBreakpoint(this.asideBreakpoint);
    this.$own(navigation.subscribe(() => this._setNav(false)));

    this.$own(env.subscribe(({ breakpoint }) => {
      this.isWide = matchesBreakpoint(this.asideBreakpoint);
      if (this.layout !== "auto") return;
      const wasMobile = this.isMobile;
      this.isMobile = this._checkMobile(breakpoint);

      if (wasMobile !== this.isMobile)
        this.$emit("layout-change", {
          layout: this.isMobile ? "mobile" : "desktop",
          breakpoint,
        });
    }));
  },

  /** @param {string} bp */
  _checkMobile(bp) {
    const switchAt = breakpointWidth(this.breakpoint) || BREAKPOINTS.md;
    return breakpointWidth(bp) < switchAt;
  },

  render() {
    /** @type {boolean} */
    let mobile;
    if (this.layout === "mobile") mobile = true;
    else if (this.layout === "desktop") mobile = false;
    else mobile = this.isMobile || !matchesBreakpoint(this.breakpoint);
    return mobile ? this.renderMobile() : this.renderDesktop();
  },

  _vars() {
    return `--lc-app-shell-nav-width: ${this._hasSlot("nav") ? this.navWidth : "0px"}; --lc-app-shell-aside-width: ${this._hasSlot("aside") && this.isWide ? this.asideWidth : "0px"}; --lc-app-shell-header-height: ${this.headerHeight};`;
  },

  renderMobile() {
    const nav = this._hasSlot("nav");
    return html`
      <div part="lc-app-shell-container" class="shell mobile" style=${this._vars()}>
        <div part="lc-app-shell-header" class="shell-header">
          ${nav
            ? html`<button type="button" part="lc-app-shell-menu-button" class="shell-menu" aria-label=${lcText(TAG, "menu")} aria-expanded=${String(this.navOpen)} @click=${() => this._setNav(true)}><lc-icon name="menu" size="20"></lc-icon></button>`
            : ""}
          ${this._hasSlot("header") ? html`<slot name="header"></slot>` : html`<slot name="navbar"></slot>`}
        </div>
        <main part="lc-app-shell-content"><slot></slot></main>
        <div part="lc-app-shell-bottom-nav"><slot name="bottom-nav"></slot></div>
        ${nav
          ? html`<lc-drawer part="lc-app-shell-drawer" position="left" width=${this.navWidth} ?open=${this.navOpen} @drawer-closed=${() => this._setNav(false)}><slot name="nav"></slot></lc-drawer>`
          : ""}
      </div>
    `;
  },

  renderDesktop() {
    return html`
      <div part="lc-app-shell-container" class="shell desktop" style=${this._vars()}>
        <div part="lc-app-shell-navbar" class="shell-navbar"><slot name="navbar"></slot></div>
        <div part="lc-app-shell-body" class="shell-body">
          <div part="lc-app-shell-nav" class="shell-nav"><slot name="nav"></slot></div>
          <main part="lc-app-shell-content" class="shell-content"><slot></slot></main>
          <div part="lc-app-shell-aside" class="shell-aside"><slot name="aside"></slot></div>
        </div>
        <div part="lc-app-shell-footer"><slot name="footer"></slot></div>
      </div>
    `;
  },
});

/**
 * App Shell Component
 *
 * @component
 * @category app
 * @tag lc-app-shell
 *
 * A lightweight responsive app shell that switches between mobile and desktop
 * layouts based on viewport size. Simpler alternative to lc-app-container
 * for apps with a top-navbar + bottom-nav pattern. A `nav` slot becomes a
 * sticky column beside the content on desktop and a drawer behind a menu
 * button on a phone; an `aside` slot is a second sticky column, shown from
 * `aside-breakpoint` up. The document scrolls; the columns stay. One `navbar`
 * serves both layouts unless a `header` slot names a toolbar for the phone.
 *
 * @slot header - Mobile: top header/toolbar, in place of the navbar
 * @slot navbar - The navigation bar: desktop always, mobile when no header slot is given
 * @slot nav - Desktop: the left column; mobile: the drawer
 * @slot default - Main content area (shared between layouts)
 * @slot aside - Desktop: the right column
 * @slot footer - Desktop: footer content
 * @slot bottom-nav - Mobile: bottom navigation
 *
 * @example Basic auto-responsive shell
 * ```html
 * <lc-app-shell breakpoint="lg">
 *   <header slot="header">Mobile Header</header>
 *   <lc-navbar slot="navbar">Desktop Nav</lc-navbar>
 *   <div>Main Content</div>
 *   <footer slot="footer">Desktop Footer</footer>
 *   <nav slot="bottom-nav">Mobile Nav</nav>
 * </lc-app-shell>
 * ```
 */
