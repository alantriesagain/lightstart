import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
/**
 * Container Component
 * Generic container component with padding, overflow, and variant support
 */

export default defineComponent({
  tag: "lc-container",
  style: true,
  props: {
    padding: T.string({
      defaultValue: "md",
      enum: ["none", "sm", "md", "lg"],
    }),
    overflow: T.string({
      enum: ["visible", "hidden", "auto", "scroll"],
    }),
    variant: T.string({
      enum: ["default", "filled", "outlined", "elevated"],
    }),
  },
});
