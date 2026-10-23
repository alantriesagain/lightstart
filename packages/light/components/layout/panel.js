import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-panel",
  props: {
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "bordered", "elevated"],
    }),
    padding: T.string({
      defaultValue: "md",
      enum: ["none", "sm", "md", "lg"],
    }),
  },
  style: true,

  render() {
    return html`
      <div part="lc-panel-container" class="panel">
        <div part="lc-panel-header" class="panel-header">
          <slot name="header"></slot>
        </div>

        <div part="lc-panel-body" class="panel-body">
          <slot></slot>
        </div>

        <div part="lc-panel-footer" class="panel-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  },
});

/**
 * Panel Component
 *
 * @component
 * @category layout
 * @tag lc-panel
 *
 * A container component with optional header and footer sections.
 *
 * @slot header - Panel header content
 * @slot default - Panel body content
 * @slot footer - Panel footer content
 *
 * @example
 * // Basic panel
 * ```html
 * <lc-panel>
 *   <div slot="header">
 *     <h3>Panel Title</h3>
 *   </div>
 *   <p>Panel content goes here...</p>
 * </lc-panel>
 * ```
 *
 * @example
 * // Bordered variant
 * ```html
 * <lc-panel variant="bordered">
 *   <div slot="header">
 *     <h3>Bordered Panel</h3>
 *   </div>
 *   <p>Content with a border around it.</p>
 * </lc-panel>
 * ```
 *
 * @example
 * // Elevated variant (with shadow)
 * ```html
 * <lc-panel variant="elevated">
 *   <div slot="header">
 *     <h3>Elevated Panel</h3>
 *   </div>
 *   <p>Content with a shadow effect.</p>
 * </lc-panel>
 * ```
 *
 * @example
 * // With footer
 * ```html
 * <lc-panel variant="bordered">
 *   <div slot="header">
 *     <h3>User Profile</h3>
 *   </div>
 *   <div>
 *     <p><strong>Name:</strong> John Doe</p>
 *     <p><strong>Email:</strong> john@example.com</p>
 *   </div>
 *   <div slot="footer">
 *     <lc-button variant="primary">Edit Profile</lc-button>
 *     <lc-button ghost>Cancel</lc-button>
 *   </div>
 * </lc-panel>
 * ```
 *
 * @example
 * // Padding variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-panel variant="bordered" padding="none">
 *     <div slot="header" style="padding: 1rem;">
 *       <h4>No Padding</h4>
 *     </div>
 *     <div style="padding: 1rem; background: #f5f5f5;">
 *       Custom padding applied manually
 *     </div>
 *   </lc-panel>
 *
 *   <lc-panel variant="bordered" padding="sm">
 *     <div slot="header"><h4>Small Padding</h4></div>
 *     <p>Less padding around content</p>
 *   </lc-panel>
 *
 *   <lc-panel variant="bordered" padding="lg">
 *     <div slot="header"><h4>Large Padding</h4></div>
 *     <p>More padding around content</p>
 *   </lc-panel>
 * </div>
 * ```
 *
 * @example
 * // Dashboard panels
 * ```html
 * <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
 *   <lc-panel variant="elevated">
 *     <div slot="header">
 *       <h4>Total Users</h4>
 *     </div>
 *     <div style="font-size: 2rem; font-weight: bold;">1,234</div>
 *     <div slot="footer" style="color: green;">
 *       ↑ 12% from last month
 *     </div>
 *   </lc-panel>
 *
 *   <lc-panel variant="elevated">
 *     <div slot="header">
 *       <h4>Revenue</h4>
 *     </div>
 *     <div style="font-size: 2rem; font-weight: bold;">$45,678</div>
 *     <div slot="footer" style="color: green;">
 *       ↑ 8% from last month
 *     </div>
 *   </lc-panel>
 *
 *   <lc-panel variant="elevated">
 *     <div slot="header">
 *       <h4>Active Sessions</h4>
 *     </div>
 *     <div style="font-size: 2rem; font-weight: bold;">456</div>
 *     <div slot="footer" style="color: red;">
 *       ↓ 3% from last month
 *     </div>
 *   </lc-panel>
 * </div>
 * ```
 *
 * @example
 * // Settings panel
 * ```html
 * <lc-panel variant="bordered">
 *   <div slot="header">
 *     <h3>Account Settings</h3>
 *   </div>
 *   <div style="display: flex; flex-direction: column; gap: 1rem;">
 *     <lc-input label="Username" value="johndoe"></lc-input>
 *     <lc-input label="Email" type="email" value="john@example.com"></lc-input>
 *     <lc-switch label="Notifications" checked></lc-switch>
 *   </div>
 *   <div slot="footer" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
 *     <lc-button ghost>Cancel</lc-button>
 *     <lc-button variant="primary">Save Changes</lc-button>
 *   </div>
 * </lc-panel>
 * ```
 */
