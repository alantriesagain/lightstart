import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { lcText } from "@lightstart/components/utils/text.js";
import notifications from "../controllers/notifications.ts";
import words from "../locales/en.js";

/** @import { NotificationRecord } from "../types.ts" */
/** @import { Prop } from "@lightstart/components/types.ts" */

/**
 * The inbox as a list. Marks a line read on the way out, so the host's handler
 * sees it already read.
 *
 * @example
 * ```html
 * <notifications-list read-all @select=${({ detail }) => close(detail)}></notifications-list>
 * ```
 */
export default defineComponent({
  tag: "notifications-list",
  props: {
    inbox: /** @type {Prop<NotificationRecord[]>} */ (T.array({ defaultValue: [], sync: notifications })),
    unread: T.number({ defaultValue: 0, sync: notifications }),
    readAll: false,
  },
  events: {
    select: T.object({ id: T.string(), url: T.string() }),
  },
  /** @param {{ id: string, url: string }} picked */
  _pick(picked) {
    notifications.markRead(picked.id);
    this.$emit("select", picked);
  },
  render() {
    if (!this.inbox.length)
      return html`<lc-empty-state icon="bell" title=${lcText("notifications-list", "empty", {}, words["notifications-list"])}></lc-empty-state>`;
    return html`
      ${this.readAll && this.unread
        ? html`<lc-button
            ghost
            size="sm"
            label=${lcText("notifications-list", "markAllRead", {}, words["notifications-list"])}
            @click=${() => notifications.markAllRead()}
          ></lc-button>`
        : ""}
      ${this.inbox.map((item) => html`
        <notifications-row
          .item=${item}
          @select=${(/** @type {CustomEvent<{ id: string, url: string }>} */ e) => this._pick(e.detail)}
        ></notifications-row>`)}`;
  },
});
