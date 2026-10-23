import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withOverlay } from "@bootstrapp/light/components/mixins/overlay.js";
import { withSwipeThreshold } from "../mixins/swipe-threshold.js";
import T from "@bootstrapp/light/types";

export default defineComponent({
  mixins: [
    withOverlay({ lockScroll: true }),
    withSwipeThreshold({ axis: "x", enabled: "open", pointerTypes: ["touch"] }),
  ],
  tag: "lc-drawer",
  style: true,
  props: {
    open: false,
    position: T.string({
      defaultValue: "right",
      enum: ["left", "right", "top", "bottom"],
    }),
    width: "280px",
    height: "50vh",
    backdrop: true,
    persistent: false,
  },

  /** @param {number} direction */
  onSwipe(direction) {
    if (this.persistent) return;
    if ((this.position === "right" && direction > 0) || (this.position === "left" && direction < 0))
      this.closeDrawer();
  },

  /** @param {MouseEvent} e */
  _handleBackdropClick(e) {
    if (e.target === e.currentTarget && !this.persistent)
      this.closeDrawer();
  },

  onEscape() {
    if (this.open && !this.persistent) this.closeDrawer();
  },

  openDrawer() {
    this.open = true;
    this.$emit("drawer-opened");
  },

  closeDrawer() {
    this.open = false;
    this.$emit("drawer-closed");
  },

  toggleDrawer() {
    this.open ? this.closeDrawer() : this.openDrawer();
  },

  render() {
    return html`
    <style>

      .panel {
          transition:
            transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94),
            opacity 0.3s ease;
          will-change: transform;
      }
    </style>
      ${
        this.backdrop && this.open
          ? html`<div
            part="lc-drawer-backdrop"
            class="backdrop"
            @click=${this._handleBackdropClick.bind(this)}
          ></div>`
          : ""
      }

      <div part="lc-drawer-panel" class="drawer-panel">
        <slot></slot>
      </div>
    `;
  },
});

/**
 * Drawer Component
 *
 * @component
 * @category overlay
 * @tag lc-drawer
 *
 * A sliding panel component for mobile navigation, sidebars, and side panels.
 * Supports positions from all four sides with backdrop overlay and keyboard navigation.
 *
 * @property {boolean} open - Controls drawer visibility
 * @property {string} position - Drawer position: 'left', 'right', 'top', 'bottom'
 * @property {string} width - Width for left/right drawers (default: '280px')
 * @property {string} height - Height for top/bottom drawers (default: '50vh')
 * @property {boolean} backdrop - Show backdrop overlay (default: true)
 * @property {boolean} persistent - Prevent closing on backdrop click (default: false)
 *
 * @method openDrawer() - Opens the drawer
 * @method closeDrawer() - Closes the drawer
 * @method toggleDrawer() - Toggles drawer open/closed state
 *
 * @event drawer-opened - Fired when drawer opens
 * @event drawer-closed - Fired when drawer closes
 *
 * @part backdrop - The backdrop overlay
 * @part panel - The drawer panel container
 *
 * @example Basic Mobile Navigation
 * ```html
 * <lc-drawer id="nav-drawer" position="left">
 *   <lc-flex direction="column" gap="none" style="padding: 1rem;">
 *     <lc-text level="3">Navigation</lc-text>
 *     <lc-divider></lc-divider>
 *     <lc-link href="/">Home</lc-link>
 *     <lc-link href="/about">About</lc-link>
 *     <lc-link href="/products">Products</lc-link>
 *     <lc-link href="/contact">Contact</lc-link>
 *   </lc-flex>
 * </lc-drawer>
 *
 * <lc-button onclick="document.querySelector('#nav-drawer').toggleDrawer()">
 *   Open Menu
 * </lc-button>
 * ```
 *
 * @example Right Sidebar
 * ```html
 * <lc-drawer position="right" width="350px">
 *   <div style="padding: 2rem;">
 *     <lc-text level="3">Settings</lc-text>
 *     <lc-form>
 *       <lc-input label="Username"></lc-input>
 *       <lc-input label="Email" type="email"></lc-input>
 *       <lc-button primary w-full>Save</lc-button>
 *     </lc-form>
 *   </div>
 * </lc-drawer>
 * ```
 *
 * @example Persistent Drawer
 * ```html
 * <!-- Won't close on backdrop click or Escape key -->
 * <lc-drawer persistent open>
 *   <div style="padding: 1rem;">
 *     <p>This drawer stays open until explicitly closed</p>
 *     <lc-button onclick="this.closest('lc-drawer').closeDrawer()">
 *       Close
 *     </lc-button>
 *   </div>
 * </lc-drawer>
 * ```
 *
 * @example Bottom Sheet (Mobile)
 * ```html
 * <lc-drawer position="bottom" height="60vh">
 *   <div style="padding: 2rem;">
 *     <lc-text level="3">Filter Options</lc-text>
 *     <lc-flex direction="column" gap="md">
 *       <lc-checkbox label="In Stock"></lc-checkbox>
 *       <lc-checkbox label="On Sale"></lc-checkbox>
 *       <lc-checkbox label="Free Shipping"></lc-checkbox>
 *       <lc-button primary w-full>Apply Filters</lc-button>
 *     </lc-flex>
 *   </div>
 * </lc-drawer>
 * ```
 *
 * @example With Hamburger Button
 * ```javascript
 * import { html } from 'lit';
 *
 * export default {
 *   tag: 'my-app',
 *   props: {
 *     drawerOpen: false,
 *   },
 *
 *   render() {
 *     return html`
 *       <lc-flex direction="column" style="height: 100vh;">
 *         <!-- Header with hamburger -->
 *         <header style="padding: 1rem; border-bottom: 1px solid #ddd;">
 *           <lc-flex align="center" justify="space-between">
 *             <lc-button
 *               ghost
 *               @click=${() => this.drawerOpen = !this.drawerOpen}
 *             >
 *               <lc-icon name="menu"></lc-icon>
 *             </lc-button>
 *             <lc-text level="2">My App</lc-text>
 *             <div style="width: 40px;"></div>
 *           </lc-flex>
 *         </header>
 *
 *         <!-- Main content -->
 *         <main flex-1 style="padding: 2rem;">
 *           <p>Main content area</p>
 *         </main>
 *
 *         <!-- Navigation drawer -->
 *         <lc-drawer ?open=${this.drawerOpen} @drawer-closed=${() => this.drawerOpen = false}>
 *           <nav style="padding: 2rem;">
 *             <lc-flex direction="column" gap="md">
 *               <lc-link href="/">Dashboard</lc-link>
 *               <lc-link href="/users">Users</lc-link>
 *               <lc-link href="/settings">Settings</lc-link>
 *             </lc-flex>
 *           </nav>
 *         </lc-drawer>
 *       </lc-flex>
 *     `;
 *   }
 * };
 * ```
 *
 * @example Responsive Drawer
 * ```html
 * <!-- Hidden on desktop (lg+), shown as drawer on mobile/tablet -->
 * <style>
 *   @media (min-width: 992px) {
 *     #mobile-drawer {
 *       display: none;
 *     }
 *   }
 * </style>
 *
 * <lc-drawer id="mobile-drawer">
 *   <lc-sidebar>Mobile navigation</lc-sidebar>
 * </lc-drawer>
 * ```
 */
