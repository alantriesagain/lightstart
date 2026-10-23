import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
/**
 * Prose Component
 * Reading container: caps the line measure, centers it, and sets the
 * long-form typography scale (defaults to the lg reading size) that
 * cascades into any contained lc-markdown.
 */

export default defineComponent({
  tag: "lc-prose",
  style: true,
  props: {
    size: T.string({
      enum: ["base", "lg", "xl"],
    }),
    wide: false,
  },
});
