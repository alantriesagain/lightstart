import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";

/** @import { Prop } from "../types.ts" */

/** @param {number} timestamp */
const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString();

export default defineComponent({
  tag: "lc-time",
  props: {
    timestamp: /** @type {Prop<number | null>} */ (T.number({ defaultValue: null })),
  },
  render() {
    const timestamp = this.timestamp;
    if (timestamp === null) return html``;
    return html`${formatTime(timestamp)}`;
  },
});
