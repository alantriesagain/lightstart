import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/**
 * Badge Component
 *
 * @component
 * @category display
 * @tag lc-badge
 *
 * Small status indicator or label for displaying metadata, counts, or status.
 * Supports multiple variants for different semantic meanings.
 *
 * @slot - Badge text content
 *
 * @example Basic Badge
 * ```html
 * <lc-badge>Default</lc-badge>
 * ```
 *
 * @example Badge Variants
 * Different colors for various statuses
 * ```html
 * <lc-badge variant="default">Default</lc-badge>
 * <lc-badge variant="success">Active</lc-badge>
 * <lc-badge variant="danger">Error</lc-badge>
 * <lc-badge variant="warning">Warning</lc-badge>
 * <lc-badge variant="info">Info</lc-badge>
 * ```
 *
 * @example Badge Sizes
 * ```html
 * <lc-badge size="sm">Small</lc-badge>
 * <lc-badge size="md">Medium</lc-badge>
 * <lc-badge size="lg">Large</lc-badge>
 * ```
 *
 * @example With Count
 * ```html
 * <lc-badge variant="danger">5</lc-badge>
 * <lc-badge variant="success">New</lc-badge>
 * ```
 *
 * @example Badge Outline
 * ```html
 * <lc-badge variant="success" outline>Approved</lc-badge>
 * ```
 *
 * @example Soft, with a leading dot
 * `soft` tints the badge instead of filling it; `dot` on a badge with a label draws a dot before it.
 * ```html
 * <lc-badge soft dot variant="success">Live</lc-badge>
 * ```
 *
 * @example A dot, for "something is here" with no number to show
 * `--lc-badge-dot-color` colours the dot, bare or beside a label, over the
 * variant's own colour. `corner` pins it to the top right of the nearest
 * positioned ancestor, or to the corner `place` names (`bottom-right`,
 * `bottom-left`, `top-left`), so the host it marks sets `position: relative`
 * on itself.
 * ```html
 * <lc-badge dot primary></lc-badge>
 * <lc-button iconOnly icon="bell"><lc-badge dot corner secondary></lc-badge></lc-button>
 * ```
 *
 * @example In Context
 * ```javascript
 *
 *
 * export default {
 *   tag: "user-profile",
 *
 *   render() {
 *     return html`
 *       <h2>
 *         John Doe
 *         <lc-badge variant="success" size="sm">Pro</lc-badge>
 *       </h2>
 *     `;
 *   }
 * };
 * ```
 */

export default defineComponent({
  tag: "lc-badge",
  props: {
    variant: "default",
    size: "md",
    outline: T.boolean(),
    soft: T.boolean(),
    dot: T.boolean(),
    corner: T.boolean(),
    place: T.string({ defaultValue: "", enum: ["", "top-right", "bottom-right", "bottom-left", "top-left"] }),
    primary: T.boolean(),
    secondary: T.boolean(),
    success: T.boolean(),
    danger: T.boolean(),
    warning: T.boolean(),
    info: T.boolean(),
  },
  style: true,
});
