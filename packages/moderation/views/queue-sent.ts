/**
 * @file `<moderation-queue-sent>`: a person's submissions as a small card. It
 * draws the items it is handed; the admin's queue has no endpoint for another
 * account's whole history, so loading them is the host's part.
 */

import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";

import { sentAt } from "../queue/lib.ts";
import moderationQueue from "../queue/controller.ts";

import type { QueueItem } from "../types.ts";

const word = (key: string, fallback: string): string => translate(key) ?? fallback;

export default defineComponent({
  tag: "moderation-queue-sent",
  props: {
    person: T.object({ attribute: false, defaultValue: null }),
    items: T.array({ attribute: false, defaultValue: [] }),
  },

  _items(): QueueItem[] {
    return this.items as QueueItem[];
  },

  render() {
    const items = this._items();
    if (!items.length) return "";
    return html`
      <section class="queue-sent" data-queue-sent>
        <span class="queue-label">${word("moderation-queue-sent.label", "Sent")}</span>
        ${items.slice(0, 12).map((item) => html`
          <lc-list-row
            size="sm"
            flat
            icon=${moderationQueue.kinds().get(item.kind)?.icon ?? "inbox"}
            label=${item.title}
            hint=${[moderationQueue.kinds().get(item.kind)?.label ?? item.kind, sentAt(item.created)].filter(Boolean).join(" · ")}
            meta=${item.status}
          ></lc-list-row>
        `)}
        ${items.length > 12 ? html`<span class="queue-dim">${word("moderation-queue-sent.more", "and more")}</span>` : ""}
      </section>
    `;
  },
});
