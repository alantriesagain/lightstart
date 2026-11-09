import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";

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
