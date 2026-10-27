import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";

/**
 * Kbd Component
 *
 * @component
 * @category display
 * @tag lc-kbd
 *
 * A key as the reader would press it. A combination is siblings.
 *
 * @slot - The key's label
 *
 * @example
 * ```html
 * <lc-kbd>⌘</lc-kbd><lc-kbd>K</lc-kbd>
 * ```
 */
export default defineComponent({
  tag: "lc-kbd",
  style: true,
  props: {
    size: T.string({ defaultValue: "sm", enum: ["xs", "sm", "md"] }),
  },
});
