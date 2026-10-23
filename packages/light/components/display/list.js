import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/**
 * List Component
 *
 * Container for list items with consistent spacing. Light DOM with no render:
 * the items are already the content. There is no <ul> to be, so the role says
 * what this is.
 */

export default defineComponent({
  tag: "lc-list",
  style: true,
  props: {
    spacing: T.string({
      defaultValue: "sm",
      enum: ["none", "xs", "sm", "md", "lg", "xl"],
    }),
    variant: T.string({
      defaultValue: "unordered",
      enum: ["ordered", "unordered", "unstyled"],
    }),
  },
  /** @this {HTMLElement} */
  connected() {
    this.setAttribute("role", "list");
  },
});
