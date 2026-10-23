import { html } from "@bootstrapp/light/html";
import { getResponsiveValue } from "@bootstrapp/light/components/utils/breakpoints.js";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { env } from "@bootstrapp/light/env";

export default defineComponent({
  tag: "lc-grid",
  props: {
    columns: "auto-fit",
    minColumnWidth: "250px",
    cols: T.string(),
    rows: T.string(),
    gap: T.string({
      defaultValue: "md",
      enum: ["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"],
    }),
    align: T.string({
      defaultValue: "stretch",
      enum: ["start", "center", "end", "stretch"],
    }),
    justify: T.string({
      defaultValue: "start",
      enum: ["start", "center", "end", "stretch"],
    }),
    _effectiveCols: T.string({ attribute: false }),
    _breakpoint: T.string({ reactive: false, defaultValue: "" }),
  },
  style: true,

  connected() {
    this._breakpoint = env.breakpoint;
    this._updateResponsiveCols();
    this.$own(env.subscribe(({ breakpoint }) => {
      if (breakpoint === this._breakpoint) return;
      this._breakpoint = breakpoint;
      this._updateResponsiveCols();
    }));
  },
  _updateResponsiveCols() {
    const resolved = getResponsiveValue(this, "columns");
    this._effectiveCols = resolved ? String(resolved) : this.columns;
  },

  render() {
    const effectiveCols = this._effectiveCols || this.columns;
    const customStyles = [];

    const isNumeric = /^\d+$/.test(effectiveCols);
    if (this.cols)
      customStyles.push(`--lc-grid-cols: repeat(${this.cols}, 1fr)`);
     else if (isNumeric)
      customStyles.push(`--lc-grid-cols: repeat(${effectiveCols}, 1fr)`);

    if (this.rows) customStyles.push(`--lc-grid-rows: ${this.rows}`);
    if (this.minColumnWidth)
      customStyles.push(`--lc-grid-min-column-width: ${this.minColumnWidth}`);
    const styleAttr = customStyles.length > 0 ? customStyles.join("; ") : "";

    return html`
      <div part="lc-grid-container" class="grid" style=${styleAttr}>
        <slot></slot>
      </div>
    `;
  },
});

/**
 * Grid Component
 *
 * @component
 * @category layout
 * @tag lc-grid
 *
 * A CSS Grid layout component for creating responsive grid layouts.
 *
 * @example
 * // Basic auto-fit grid
 * ```html
 * <lc-grid>
 *   <lc-panel variant="bordered">Item 1</lc-panel>
 *   <lc-panel variant="bordered">Item 2</lc-panel>
 *   <lc-panel variant="bordered">Item 3</lc-panel>
 *   <lc-panel variant="bordered">Item 4</lc-panel>
 * </lc-grid>
 * ```
 *
 * @example
 * // Fixed number of columns
 * ```html
 * <lc-grid columns="3">
 *   <lc-panel variant="bordered">Item 1</lc-panel>
 *   <lc-panel variant="bordered">Item 2</lc-panel>
 *   <lc-panel variant="bordered">Item 3</lc-panel>
 *   <lc-panel variant="bordered">Item 4</lc-panel>
 *   <lc-panel variant="bordered">Item 5</lc-panel>
 *   <lc-panel variant="bordered">Item 6</lc-panel>
 * </lc-grid>
 * ```
 *
 * @example
 * // Custom minimum column width
 * ```html
 * <lc-grid min-column-width="150px">
 *   <lc-panel variant="bordered">Small 1</lc-panel>
 *   <lc-panel variant="bordered">Small 2</lc-panel>
 *   <lc-panel variant="bordered">Small 3</lc-panel>
 *   <lc-panel variant="bordered">Small 4</lc-panel>
 *   <lc-panel variant="bordered">Small 5</lc-panel>
 *   <lc-panel variant="bordered">Small 6</lc-panel>
 * </lc-grid>
 * ```
 *
 * @example
 * // Gap variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 2rem;">
 *   <div>
 *     <p>Small gap:</p>
 *     <lc-grid columns="3" gap="sm">
 *       <div style="background: #ddd; padding: 1rem;">Item 1</div>
 *       <div style="background: #ddd; padding: 1rem;">Item 2</div>
 *       <div style="background: #ddd; padding: 1rem;">Item 3</div>
 *     </lc-grid>
 *   </div>
 *
 *   <div>
 *     <p>Large gap:</p>
 *     <lc-grid columns="3" gap="lg">
 *       <div style="background: #ddd; padding: 1rem;">Item 1</div>
 *       <div style="background: #ddd; padding: 1rem;">Item 2</div>
 *       <div style="background: #ddd; padding: 1rem;">Item 3</div>
 *     </lc-grid>
 *   </div>
 * </div>
 * ```
 *
 * @example
 * // Product grid
 * ```html
 * <lc-grid min-column-width="200px" gap="lg">
 *   ${products.map(product => html`
 *     <lc-panel variant="elevated">
 *       <img src=${product.image} alt=${product.name} style="width: 100%; height: 200px; object-fit: cover;">
 *       <div style="padding: 1rem;">
 *         <h3>${product.name}</h3>
 *         <p>${product.price}</p>
 *         <lc-button variant="primary" style="width: 100%;">Add to Cart</lc-button>
 *       </div>
 *     </lc-panel>
 *   `)}
 * </lc-grid>
 * ```
 *
 * @example
 * // Dashboard grid
 * ```html
 * <lc-grid columns="4" gap="md">
 *   <lc-panel variant="elevated">
 *     <h4>Total Users</h4>
 *     <p style="font-size: 2rem; font-weight: bold;">1,234</p>
 *   </lc-panel>
 *   <lc-panel variant="elevated">
 *     <h4>Revenue</h4>
 *     <p style="font-size: 2rem; font-weight: bold;">$45K</p>
 *   </lc-panel>
 *   <lc-panel variant="elevated">
 *     <h4>Orders</h4>
 *     <p style="font-size: 2rem; font-weight: bold;">567</p>
 *   </lc-panel>
 *   <lc-panel variant="elevated">
 *     <h4>Sessions</h4>
 *     <p style="font-size: 2rem; font-weight: bold;">890</p>
 *   </lc-panel>
 * </lc-grid>
 * ```
 *
 * @example
 * // Image gallery
 * ```html
 * <lc-grid min-column-width="150px" gap="xs">
 *   <img src="/image1.jpg" alt="Image 1" style="width: 100%; height: 150px; object-fit: cover;">
 *   <img src="/image2.jpg" alt="Image 2" style="width: 100%; height: 150px; object-fit: cover;">
 *   <img src="/image3.jpg" alt="Image 3" style="width: 100%; height: 150px; object-fit: cover;">
 *   <img src="/image4.jpg" alt="Image 4" style="width: 100%; height: 150px; object-fit: cover;">
 *   <img src="/image5.jpg" alt="Image 5" style="width: 100%; height: 150px; object-fit: cover;">
 *   <img src="/image6.jpg" alt="Image 6" style="width: 100%; height: 150px; object-fit: cover;">
 * </lc-grid>
 * ```
 *
 * @example
 * // Feature cards
 * ```html
 * <lc-grid columns="3" gap="xl">
 *   <lc-panel variant="bordered" style="text-align: center;">
 *     <lc-icon name="zap" size="xl" style="color: var(--color-primary);"></lc-icon>
 *     <h3>Fast</h3>
 *     <p>Lightning fast performance for all your needs.</p>
 *   </lc-panel>
 *
 *   <lc-panel variant="bordered" style="text-align: center;">
 *     <lc-icon name="shield" size="xl" style="color: var(--color-success);"></lc-icon>
 *     <h3>Secure</h3>
 *     <p>Enterprise-grade security you can trust.</p>
 *   </lc-panel>
 *
 *   <lc-panel variant="bordered" style="text-align: center;">
 *     <lc-icon name="trending-up" size="xl" style="color: var(--color-info);"></lc-icon>
 *     <h3>Scalable</h3>
 *     <p>Grows seamlessly with your business.</p>
 *   </lc-panel>
 * </lc-grid>
 * ```
 *
 * @example
 * // Responsive columns (using CSS custom property)
 * ```html
 * <lc-grid style="--grid-columns: 1;" gap="md">
 *   <lc-panel variant="bordered">Mobile: 1 column</lc-panel>
 *   <lc-panel variant="bordered">Mobile: 1 column</lc-panel>
 * </lc-grid>
 *
 * <style>
 *   @media (min-width: 768px) {
 *     lc-grid {
 *       --grid-columns: 2;
 *     }
 *   }
 *   @media (min-width: 1024px) {
 *     lc-grid {
 *       --grid-columns: 3;
 *     }
 *   }
 * </style>
 * ```
 *
 * @example
 * // Team member grid
 * ```html
 * <lc-grid min-column-width="200px" gap="lg">
 *   ${teamMembers.map(member => html`
 *     <lc-panel variant="elevated" style="text-align: center;">
 *       <lc-avatar size="xl" src=${member.photo}></lc-avatar>
 *       <h3>${member.name}</h3>
 *       <p>${member.role}</p>
 *       <lc-flex direction="horizontal" justify="center" spacing="sm">
 *         <lc-link href=${member.twitter}><lc-icon name="twitter"></lc-icon></lc-link>
 *         <lc-link href=${member.linkedin}><lc-icon name="linkedin"></lc-icon></lc-link>
 *       </lc-flex>
 *     </lc-panel>
 *   `)}
 * </lc-grid>
 * ```
 */
