/**
 * @file `<moderation-queue>`: the review queue at `/admin/queue`. It draws the
 * pending submissions grouped under the headings their kinds describe, the
 * selected item's detail beside the list, and a Refresh action. It shows a
 * sign-in or not-allowed state unless the signed-in account is an admin; the
 * server refuses a non-admin's calls either way.
 */

import { defineComponent, translate } from "@lightstart/light";
import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { auth } from "@lightstart/auth/page";

import { groupOf, sentAt } from "../queue/lib.ts";
import moderationQueue from "../queue/controller.ts";

import type { AuthUser } from "@lightstart/auth/server/types.ts";
import type { QueueItem } from "../types.ts";

const ALL = "all";

const word = (key: string, fallback: string): string => translate(key) ?? fallback;

export default defineComponent({
  tag: "moderation-queue",
  props: {
    items: T.array({ defaultValue: [], sync: moderationQueue }),
    loading: T.boolean({ defaultValue: false, sync: moderationQueue }),
    busy: T.string({ defaultValue: "", sync: moderationQueue }),
    message: T.string({ defaultValue: "", sync: moderationQueue }),
    user: T.object({ attribute: false, defaultValue: null, sync: auth }),
    group: ALL,
    selected: "",
  },

  connected() {
    return moderationQueue.load();
  },

  _items(): QueueItem[] {
    return this.items as QueueItem[];
  },

  _user(): AuthUser | null {
    return this.user as unknown as AuthUser | null;
  },

  _groups(): ReturnType<typeof moderationQueue.groups> {
    return moderationQueue.groups();
  },

  _scoped(): QueueItem[] {
    const items = this._items();
    if (this.group === ALL) return items;
    const kinds = moderationQueue.kinds();
    return items.filter((item) => groupOf(item, kinds) === this.group);
  },

  _icon(item: QueueItem): string {
    return moderationQueue.kinds().get(item.kind)?.icon ?? "inbox";
  },

  _hint(item: QueueItem): string {
    const kind = moderationQueue.kinds().get(item.kind);
    return [item.userId, kind?.label ?? item.kind, sentAt(item.created)].filter(Boolean).join(" · ");
  },

  _gate(): object | string {
    const user = this._user();
    if (user === null)
      return html`
        <div class="queue-gate" data-queue-gate="sign-in">
          <h2>${word("moderation-queue.signIn", "Sign in to review")}</h2>
          <p>${word("moderation-queue.signInBody", "The review queue is only for an admin.")}</p>
        </div>
      `;
    return html`
      <div class="queue-gate" data-queue-gate="not-allowed">
        <h2>${word("moderation-queue.notAllowed", "Not allowed")}</h2>
        <p>${word("moderation-queue.notAllowedBody", "This account is not an admin.")}</p>
      </div>
    `;
  },

  _switch(groups: ReturnType<typeof moderationQueue.groups>): object | string {
    if (groups.length < 2) return "";
    const total = groups.reduce((count, entry) => count + entry.items.length, 0);
    const options = [{ value: ALL, label: word("moderation-queue.all", "All"), count: total }, ...groups.map((group) => ({ value: group.label, label: group.label, count: group.items.length }))];
    return html`
      <lc-segmented
        size="sm"
        data-queue-groups
        .options=${options}
        value=${this.group}
        @change=${(event: CustomEvent<{ value: string }>) => { this.group = event.detail.value; }}
      ></lc-segmented>
    `;
  },

  _row(item: QueueItem, selected: string): object | string {
    return html`
      <lc-list-row
        size="sm"
        data-queue-item=${item.id}
        icon=${this._icon(item)}
        label=${item.title}
        hint=${this._hint(item)}
        meta=${item.status === "approved" ? word("moderation-queue.approved", "Approved") : ""}
        ?selected=${item.id === selected}
        @select=${() => { this.selected = item.id; }}
      ></lc-list-row>
    `;
  },

  _detail(item: QueueItem): object | string {
    const kinds = moderationQueue.kinds();
    return html`
      <section class="queue-detail-pane">
        <moderation-queue-detail .item=${item} data-group=${groupOf(item, kinds)}></moderation-queue-detail>
      </section>
    `;
  },

  render() {
    const user = this._user();
    if (user === null || user.admin !== true) return html`<div class="queue-page">${this._gate()}</div>`;
    const groups = this._groups();
    const shown = this.group === ALL ? groups : groups.filter((group) => group.label === this.group);
    const flat = shown.flatMap((group) => group.items);
    const selected = flat.some((item) => item.id === this.selected) ? this.selected : flat[0]?.id ?? "";
    const item = selected === "" ? null : moderationQueue.item(selected);
    return html`
      <div class="queue-page">
        <div class="queue-bar">
          ${this._switch(groups)}
          <span class="queue-spacer"></span>
          ${this.message ? html`<span class="queue-message" data-queue-message>${this.message}</span>` : ""}
          <lc-button size="sm" ghost icon="refresh-cw" ?disabled=${this.loading} @click=${() => void moderationQueue.load()}>
            ${word("moderation-queue.refresh", "Refresh")}
          </lc-button>
        </div>
        <div class="queue-columns">
          <section class="queue-list" data-queue-list>
            ${this.loading && !this._items().length ? html`<lc-spinner></lc-spinner>` : ""}
            ${!this.loading && !flat.length ? html`<p class="queue-empty" data-queue-empty>${word("moderation-queue.empty", "Nothing waits here.")}</p>` : ""}
            ${shown.map((group) => html`
              <div class="queue-group" data-queue-group=${group.label}>
                <span>${group.label}</span><span>${group.items.length}</span>
              </div>
              ${group.items.map((entry) => this._row(entry, selected))}
            `)}
          </section>
          ${item ? this._detail(item) : ""}
        </div>
      </div>
    `;
  },
});
