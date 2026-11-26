/**
 * @file `<moderation-queue-detail>`: one waiting item. Its kind's `detail` tag
 * draws the body when the kind names one, else the payload is read out as
 * fields; the review moves the item's status allows are the footer actions,
 * with Remove beside them.
 */

import { defineComponent, translate } from "@lightstart/light";
import { element, html } from "@lightstart/light/html";
import T from "@lightstart/light/types";

import { movesOf, sentAt } from "../queue/lib.ts";
import moderationQueue from "../queue/controller.ts";

import type { QueueItem } from "../types.ts";

const word = (key: string, fallback: string): string => translate(key) ?? fallback;

const MOVE: Record<string, { key: string, fallback: string, icon: string, primary: boolean }> = {
  approved: { key: "moderation-queue-detail.approve", fallback: "Approve", icon: "check", primary: true },
  rejected: { key: "moderation-queue-detail.reject", fallback: "Reject", icon: "x", primary: false },
  pending: { key: "moderation-queue-detail.backToPending", fallback: "Back to pending", icon: "undo-2", primary: false },
};

const STATUS: Record<string, string> = { pending: "warning", approved: "success", open: "warning" };

export default defineComponent({
  tag: "moderation-queue-detail",
  props: {
    item: T.object({ attribute: false, defaultValue: null }),
    busy: T.string({ defaultValue: "", sync: moderationQueue }),
  },

  _item(): QueueItem | null {
    return this.item as unknown as QueueItem | null;
  },

  _body(item: QueueItem): object | string {
    const kind = moderationQueue.kinds().get(item.kind);
    if (kind?.detail) return element(kind.detail, { ".item": item });
    return element("moderation-queue-payload", { ".payload": item.record.payload ?? {} });
  },

  _move(to: string, item: QueueItem): void {
    if (to === "approved") void moderationQueue.approve(item.id);
    else if (to === "rejected") void moderationQueue.reject(item.id);
  },

  render() {
    const item = this._item();
    if (item === null) return "";
    const kind = moderationQueue.kinds().get(item.kind);
    const label = kind?.label ?? item.kind;
    const busy = this.busy === item.id;
    return html`
      <article class="queue-card" data-queue-detail=${item.id}>
        <header class="queue-head">
          <div class="queue-head-text">
            <h2>${item.title === label ? label : `${label} · ${item.title}`}</h2>
            <span class="queue-dim">${[sentAt(item.created), item.id].filter(Boolean).join(" · ")}</span>
          </div>
          <lc-tag size="sm" variant=${STATUS[item.status] ?? "default"}>${item.status}</lc-tag>
        </header>
        <div class="queue-body">${this._body(item)}</div>
        <footer class="queue-foot" data-queue-actions>
          ${movesOf(item.status).filter((to) => to === "approved" || to === "rejected").map((to) => html`
            <lc-button
              size="sm"
              ?primary=${MOVE[to]?.primary ?? false}
              icon=${MOVE[to]?.icon ?? "arrow-right"}
              data-queue-move=${to}
              ?disabled=${busy}
              @click=${() => this._move(to, item)}
            >${MOVE[to] ? word(MOVE[to].key, MOVE[to].fallback) : to}</lc-button>
          `)}
          <lc-button
            size="sm"
            ghost
            icon="trash-2"
            data-queue-remove
            ?disabled=${busy}
            @click=${() => void moderationQueue.remove(item.id)}
          >${word("moderation-queue-detail.remove", "Remove")}</lc-button>
          ${item.status === "approved" && kind?.terminal !== true ? html`<span class="queue-dim">${word("moderation-queue-detail.published", "Goes public at the next publish.")}</span>` : ""}
        </footer>
      </article>
    `;
  },
});
