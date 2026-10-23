import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-join",
  props: {
    orientation: T.string({
      defaultValue: "horizontal",
      enum: ["horizontal", "vertical"],
    }),
  },
  style: true,
});

/**
 * Join Component
 *
 * @component
 * @category form
 * @tag lc-join
 *
 * Groups elements together by joining their borders
 *
 * @example
 * // Button group
 * ```html
 * <lc-join>
 *   <lc-button>Button 1</lc-button>
 *   <lc-button>Button 2</lc-button>
 *   <lc-button>Button 3</lc-button>
 * </lc-join>
 * ```
 *
 * @example
 * // Input with button
 * ```html
 * <lc-join>
 *   <lc-input placeholder="Search..."></lc-input>
 *   <lc-button variant="primary">Search</lc-button>
 * </lc-join>
 * ```
 *
 * @example
 * // A pill that paints itself, holding a popover
 * Six variables cover the whole surface: `--lc-join-background`,
 * `--lc-join-backdrop`, `--lc-join-shadow`, `--lc-join-border-color`,
 * `--lc-join-divider-color` and `--lc-join-border-radius`. A child with a
 * popover (a select's menu, a search's results) needs
 * `--lc-join-overflow: visible`, which is safe as long as the children stay
 * transparent and let the host paint the corners.
 * ```html
 * <lc-join style="--lc-join-border-radius:9999px;--lc-join-background:rgba(255,255,255,0.82);--lc-join-backdrop:blur(22px);--lc-join-overflow:visible">
 *   <a href="/">meetup.rio</a>
 *   <lc-search collapsible></lc-search>
 * </lc-join>
 * ```
 *
 * @example
 * // Vertical orientation
 * ```html
 * <lc-join orientation="vertical">
 *   <lc-button>Top</lc-button>
 *   <lc-button>Middle</lc-button>
 *   <lc-button>Bottom</lc-button>
 * </lc-join>
 * ```
 *
 * @example
 * // Mixed components
 * ```html
 * <lc-join>
 *   <lc-select options='["Option 1", "Option 2"]'></lc-select>
 *   <lc-input placeholder="Value"></lc-input>
 *   <lc-button variant="primary">Submit</lc-button>
 * </lc-join>
 * ```
 */
