import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-float-card",
  style: true,
  props: {
    animation: T.string({
      defaultValue: "none",
      enum: ["none", "slow", "delayed", "fast"],
    }),
    hide: T.string({
      defaultValue: "",
      enum: ["", "sm", "md", "lg"],
    }),
  },
  render() {
    return html`<slot></slot>`;
  },
});
