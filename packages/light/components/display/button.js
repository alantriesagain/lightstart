import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-button",
  props: {
    variant: T.string(),
    primary: T.boolean(),
    secondary: T.boolean(),
    danger: T.boolean(),
    success: T.boolean(),
    ghost: T.boolean(),
    outline: T.boolean(),
    border: T.boolean(),
    flat: T.boolean(),
    size: T.string({
      defaultValue: "md",
      enum: ["xs", "sm", "md", "lg", "xl"],
    }),
    wFull: false,
    iconOnly: false,
    selected: false,
    glass: false,
  },
  extends: "lc-link",
  style: true,
});

/**
 * Button Component
 *
 * @component
 * @category display
 * @tag lc-button
 *
 * A flexible button component for user actions. Supports multiple variants,
 * sizes, icons, and states. Extends lc-link for navigation functionality.
 *
 * @example Basic Button
 * ```html
 * <lc-button>Click me</lc-button>
 * ```
 *
 * @example Button Variants
 * Different visual styles for various action types
 * ```html
 * <div class="flex flex-col gap-2 items-center">
 *  <lc-button>Default</lc-button>
 *  <lc-button primary>Primary</lc-button>
 *  <lc-button secondary>Secondary</lc-button>
 *  <lc-button success>Success</lc-button>
 *  <lc-button danger>Danger</lc-button>
 * </div>
 * ```
 *
 * @example Button Styles
 * Different style treatments
 * ```html
 * <div class="flex flex-col gap-2 items-center">
 *  <lc-button primary>Solid</lc-button>
 *  <lc-button danger ghost>Ghost</lc-button>
 *  <lc-button secondary outline>Outline</lc-button>
 *  <lc-button primary border>Border</lc-button>
 * </div>
 * ```
 *
 * @example Button Sizes
 * ```html
 * <div class="flex flex-col gap-2 items-center">
 *  <lc-button size="xs">Extra Small</lc-button>
 *  <lc-button size="sm">Small</lc-button>
 *  <lc-button size="md">Medium</lc-button>
 *  <lc-button size="lg">Large</lc-button>
 *  <lc-button size="xl">Extra Large</lc-button>
 * </div>
 * ```
 *
 * @example Disabled Button
 * ```html
 * <lc-button disabled>Cannot Click</lc-button>
 * ```
 *
 * @example With Click Handler
 * ```javascript
 *
 *
 * export default {
 *   tag: "my-component",
 *
 *   handleClick() {
 *     alert("Button clicked!");
 *   },
 *
 *   render() {
 *     return html`
 *       <lc-button
 *         primary
 *         @click=${this.handleClick.bind(this)}
 *       >
 *         Click me
 *       </lc-button>
 *     `;
 *   }
 * };
 * ```
 *
 * @example As Link
 * ```html
 * <lc-button href="/dashboard">Go to Dashboard</lc-button>
 * ```
 */
