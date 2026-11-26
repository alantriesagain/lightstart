/// <reference lib="dom" />
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { timeAgo } from "@lightstart/components/utils/time-ago.js";

/** @import { NotificationRecord } from "../types.ts" */
/** @import { Prop } from "@lightstart/components/types.ts" */

/** @returns {string} */
const locale = () => globalThis.document?.documentElement.lang || "en";

/**
 * One line of the inbox. `lc-list-row` draws it and owns the navigation, so a
 * tap follows the line's own url without this view routing anything.
 */
export default defineComponent({
  tag: "notifications-row",
  props: {
    item: /** @type {Prop<NotificationRecord | null>} */ (T.object({ attribute: false, defaultValue: null })),
  },
  events: {
    select: T.object({ id: T.string(), url: T.string() }),
  },
  render() {
    const item = this.item;
    if (!item) return html``;
    return html`
      <lc-list-row
        flat
        wrap
        href=${item.url}
        icon=${item.icon || "bell"}
        label=${item.title}
        hint=${item.body}
        meta=${timeAgo(item.createdAt, locale())}
        ?unread=${!item.read}
        data-notification=${item.id}
        @select=${() => this.$emit("select", { id: item.id, url: item.url })}
      ></lc-list-row>`;
  },
});
