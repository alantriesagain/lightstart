import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/**
 * Text Component
 *
 * The one text primitive: inline text, headings (`level`) and section labels
 * (`eyebrow`). Light DOM with no render: the children are already the content,
 * so there is nothing to wrap. Styling lands on the host, the way `lc-badge`
 * does it, which also means a class on the call site still wins.
 */

export default defineComponent({
  tag: "lc-text",
  style: true,
  props: {
    size: T.string({
      enum: ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"],
    }),
    weight: T.string({
      enum: ["normal", "medium", "semibold", "bold", "black"],
    }),
    tracking: T.string({
      enum: ["tight", "normal", "wide", "wider", "widest"],
    }),
    color: T.string({
      enum: [
        "primary",
        "secondary",
        "success",
        "danger",
        "warning",
        "info",
        "muted",
        "inverse",
      ],
    }),
    muted: false,
    mono: false,
    align: T.string({ enum: ["left", "center", "right"] }),
    transform: T.string({
      enum: ["capitalize", "uppercase", "lowercase", "none"],
    }),
    eyebrow: false,
    level: T.number({ min: 1, max: 6 }),
  },
  updated() {
    if (!this.level) {
      this.removeAttribute("role");
      this.removeAttribute("aria-level");
      return;
    }
    this.setAttribute("role", "heading");
    this.setAttribute("aria-level", String(this.level));
  },
});
