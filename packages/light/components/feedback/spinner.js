import T from "@bootstrapp/light/types";
/**
 * Spinner Component
 *
 * @component
 * @category feedback
 * @tag lc-spinner
 *
 * A loading spinner component with multiple animation variants and sizes.
 * Uses pure CSS animations for performance.
 *
 * @example Basic Spinner
 * ```html
 * <lc-spinner></lc-spinner>
 * ```
 *
 * @example Spinner Variants
 * Different animation styles
 * ```html
 * <div class="flex gap-4">
 *   <lc-spinner variant="circular"></lc-spinner>
 *   <lc-spinner variant="dots"></lc-spinner>
 *   <lc-spinner variant="bars"></lc-spinner>
 * </div>
 * ```
 *
 * @example Spinner Sizes
 * ```html
 * <div class="flex gap-4 items-center">
 *   <lc-spinner size="xs"></lc-spinner>
 *   <lc-spinner size="sm"></lc-spinner>
 *   <lc-spinner size="md"></lc-spinner>
 *   <lc-spinner size="lg"></lc-spinner>
 *   <lc-spinner size="xl"></lc-spinner>
 * </div>
 * ```
 *
 * @example Colored Spinner
 * ```html
 * <lc-spinner primary></lc-spinner>
 * <lc-spinner secondary></lc-spinner>
 * <lc-spinner success></lc-spinner>
 * <lc-spinner danger></lc-spinner>
 * ```
 *
 * @example Custom Color
 * ```html
 * <lc-spinner style="--spinner-color: #ff6b6b;"></lc-spinner>
 * ```
 */
import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-spinner",
  props: {
    variant: T.string({
      defaultValue: "circular",
      enum: ["circular", "dots", "bars"],
    }),
    size: T.string({
      defaultValue: "md",
      enum: ["xs", "sm", "md", "lg", "xl"],
    }),
    primary: T.boolean(),
    secondary: T.boolean(),
    success: T.boolean(),
    danger: T.boolean(),
    warning: T.boolean(),
    info: T.boolean(),
  },
  style: true,
  render() {

    if (this.variant === "circular")
      return html``;

    if (this.variant === "dots")
      return html`
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      `;

    if (this.variant === "bars")
      return html`
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      `;

    return html``;
  },
});
