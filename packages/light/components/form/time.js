import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

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
