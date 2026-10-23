import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-sidebar",
  style: true,
  props: {
    position: T.string({
      defaultValue: "left",
      enum: ["left", "right"],
    }),
    collapsed: false,
    collapsible: true,
  },

  toggle() {
    if (this.collapsible) {
      this.collapsed = !this.collapsed;
      this.$emit("toggle", { collapsed: this.collapsed });
    }
  },

  render() {
    return html`
      <div part="lc-sidebar-header" class="sidebar-header">
        <slot name="header"></slot>
        ${
          this.collapsible
            ? html`
              <button
                part="lc-sidebar-toggle"
                class="sidebar-toggle"
                @click=${this.toggle}
                aria-label=${this.collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <lc-icon
                  name=${
                    this.collapsed
                      ? this.position === "left"
                        ? "chevron-right"
                        : "chevron-left"
                      : this.position === "left"
                        ? "chevron-left"
                        : "chevron-right"
                  }
                ></lc-icon>
              </button>
            `
            : ""
        }
      </div>

      <div part="lc-sidebar-content" class="sidebar-content">
        <slot></slot>
      </div>

      <div part="lc-sidebar-footer" class="sidebar-footer">
        <slot name="footer"></slot>
      </div>
    `;
  },
});

/**
 * Sidebar Component
 *
 * @component
 * @category navigation
 * @tag lc-sidebar
 *
 * A simple collapsible sidebar container. Use with lc-menu for navigation.
 *
 * @slot header - Content for the sidebar header (logo, brand)
 * @slot default - Main sidebar content (navigation, lc-menu)
 * @slot footer - Content for the sidebar footer (user info, settings)
 *
 * @example
 * // Basic sidebar with menu
 * ```html
 * <lc-sidebar>
 *   <div slot="header">
 *     <lc-icon name="shield"></lc-icon>
 *     <span>Admin</span>
 *   </div>
 *
 *   <lc-menu variant="sidebar">
 *     <li><lc-link href="/dashboard" icon="layout-dashboard">Dashboard</lc-link></li>
 *     <li><lc-link href="/users" icon="users">Users</lc-link></li>
 *     <li><lc-link href="/settings" icon="settings">Settings</lc-link></li>
 *   </lc-menu>
 *
 *   <div slot="footer">
 *     <lc-darkmode></lc-darkmode>
 *   </div>
 * </lc-sidebar>
 * ```
 *
 * @example
 * // Collapsible sidebar
 * ```html
 * <lc-sidebar collapsible ?collapsed=${this.collapsed} @toggle=${this.handleToggle}>
 *   <div slot="header">My App</div>
 *   <lc-menu variant="sidebar">
 *     <li><lc-link href="/" icon="house">Home</lc-link></li>
 *   </lc-menu>
 * </lc-sidebar>
 * ```
 *
 * @example
 * // With accordion menu
 * ```html
 * <lc-sidebar>
 *   <lc-menu variant="sidebar">
 *     <li><lc-link href="/home" icon="house">Home</lc-link></li>
 *     <li>
 *       <details open>
 *         <summary><lc-icon name="database"></lc-icon> Models</summary>
 *         <ul>
 *           <li><lc-link href="/models/users">Users</lc-link></li>
 *           <li><lc-link href="/models/posts">Posts</lc-link></li>
 *         </ul>
 *       </details>
 *     </li>
 *   </lc-menu>
 * </lc-sidebar>
 * ```
 */
