import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";

/** @import { Prop } from "../types.js" */

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
