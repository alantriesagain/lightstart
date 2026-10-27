import { html } from "/app/__light-runtime__.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";

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
