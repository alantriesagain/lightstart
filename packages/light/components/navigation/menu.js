import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-menu",
  props: {
    size: T.string({
      defaultValue: "md",
      enum: ["sm", "md", "lg"],
    }),
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "bordered", "compact", "flush", "sidebar"],
    }),
    rounded: true,
    bordered: true,
  },
  style: true,
});

/**
 * Menu Component
 *
 * @component
 * @category navigation
 * @tag lc-menu
 *
 * A vertical menu list for navigation or actions. Can be used with lc-dropdown for dropdown menus.
 *
 * @example
 * // Basic menu
 * ```html
 * <lc-menu>
 *   <li role="menuitem"><a href="#home">Home</a></li>
 *   <li role="menuitem"><a href="#about">About</a></li>
 *   <li role="menuitem"><a href="#services">Services</a></li>
 *   <li role="menuitem"><a href="#contact">Contact</a></li>
 * </lc-menu>
 * ```
 *
 * @example
 * // With icons
 * ```html
 * <lc-menu>
 *   <li role="menuitem">
 *     <a href="#profile">
 *       <lc-icon name="user"></lc-icon>
 *       Profile
 *     </a>
 *   </li>
 *   <li role="menuitem">
 *     <a href="#settings">
 *       <lc-icon name="settings"></lc-icon>
 *       Settings
 *     </a>
 *   </li>
 *   <li role="menuitem">
 *     <a href="#help">
 *       <lc-icon name="circle-help"></lc-icon>
 *       Help
 *     </a>
 *   </li>
 *   <li role="separator" class="divider"></li>
 *   <li role="menuitem">
 *     <a href="#logout">
 *       <lc-icon name="log-out"></lc-icon>
 *       Logout
 *     </a>
 *   </li>
 * </lc-menu>
 * ```
 *
 * @example
 * // Bordered variant
 * ```html
 * <lc-menu variant="bordered">
 *   <li role="menuitem"><a href="#dashboard">Dashboard</a></li>
 *   <li role="menuitem"><a href="#reports">Reports</a></li>
 *   <li role="menuitem"><a href="#analytics">Analytics</a></li>
 * </lc-menu>
 * ```
 *
 * @example
 * // Compact variant
 * ```html
 * <lc-menu variant="compact" size="sm">
 *   <li role="menuitem"><a href="#item1">Item 1</a></li>
 *   <li role="menuitem"><a href="#item2">Item 2</a></li>
 *   <li role="menuitem"><a href="#item3">Item 3</a></li>
 * </lc-menu>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; gap: 2rem;">
 *   <lc-menu size="sm">
 *     <li role="menuitem"><a href="#">Small</a></li>
 *     <li role="menuitem"><a href="#">Menu</a></li>
 *   </lc-menu>
 *
 *   <lc-menu size="md">
 *     <li role="menuitem"><a href="#">Medium</a></li>
 *     <li role="menuitem"><a href="#">Menu</a></li>
 *   </lc-menu>
 *
 *   <lc-menu size="lg">
 *     <li role="menuitem"><a href="#">Large</a></li>
 *     <li role="menuitem"><a href="#">Menu</a></li>
 *   </lc-menu>
 * </div>
 * ```
 *
 * @example
 * // In a dropdown
 * ```html
 * <lc-button popovertarget="actions-menu">Actions</lc-button>
 * <lc-dropdown id="actions-menu">
 *   <a href="#edit">Edit</a>
 *   <a href="#duplicate">Duplicate</a>
 *   <a href="#archive">Archive</a>
 *   <hr>
 *   <a href="#delete" class="text-error">Delete</a>
 * </lc-dropdown>
 * ```
 *
 * @example
 * // With nested submenus
 * ```html
 * <lc-menu>
 *   <li role="menuitem"><a href="#home">Home</a></li>
 *   <li role="menuitem">
 *     <details>
 *       <summary>Products</summary>
 *       <ul>
 *         <li><a href="#laptops">Laptops</a></li>
 *         <li><a href="#phones">Phones</a></li>
 *         <li><a href="#tablets">Tablets</a></li>
 *       </ul>
 *     </details>
 *   </li>
 *   <li role="menuitem"><a href="#about">About</a></li>
 * </lc-menu>
 * ```
 *
 * @example
 * // With active state
 * ```html
 * <lc-menu>
 *   <li role="menuitem"><a href="#dashboard">Dashboard</a></li>
 *   <li role="menuitem"><a href="#projects" class="active">Projects</a></li>
 *   <li role="menuitem"><a href="#team">Team</a></li>
 *   <li role="menuitem"><a href="#settings">Settings</a></li>
 * </lc-menu>
 * ```
 */
