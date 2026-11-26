/**
 * @file The `notifications` controller: one inbox out of however many sources
 * an app fills into `notificationSources`.
 *
 * A source answers what exists now. It is never asked what is new, because that
 * is this controller's question and the answer is per device: the ids it has
 * already shown, kept in local storage beside the ids it has been told were
 * read. A source marked `retain` has its rows put through that set and the ones
 * that were new are held, so a line survives its source no longer carrying it.
 *
 * Those new ones are also `arrived`: set after a refresh that found any, newest
 * first and unread, for a host that wants to say so as it happens. A device's
 * first look finds nothing arrived, since everything is new to it and none of
 * it just happened.
 */

/// <reference lib="dom" />
import { defineController } from "@lightstart/light/controller";
import type { NotificationRecord, NotificationSource, SourceContext } from "../types.ts";
import { mergeInbox, takeNew, unreadCount } from "../lib/inbox.ts";
import { notificationSources } from "../page/sources.ts";

interface SourceEntry {
  list: (context: SourceContext) => NotificationRecord[] | Promise<NotificationRecord[]>;
  retain: boolean;
}

const key = (name: string): string => `notifications:${name}`;

const notifications = defineController({
  name: "notifications",
  props: {
    inbox: [] as NotificationRecord[],
    unread: 0,
    pending: false,
    readIds: [] as string[],
    seenIds: [] as string[],
    news: [] as NotificationRecord[],
    arrived: [] as NotificationRecord[],
  },
  sync: {
    readIds: { to: "local", key: key("readIds") },
    seenIds: { to: "local", key: key("seenIds") },
    news: { to: "local", key: key("news") },
  },
  _sources: new Map<string, SourceEntry>(),
  _inflight: null as Promise<NotificationRecord[]> | null,
  _trailing: null as Promise<NotificationRecord[]> | null,
  _started: false,

  connected() {
    this._started = false;
    const off = notificationSources.items.subscribe((items) => {
      const started = this._started;
      this._started = true;
      this._setSources(items);
      if (started) this.refresh().catch(() => []);
    });
    this.$own(off);

    const onVisible = (): void => {
      if (globalThis.document?.visibilityState === "visible") this.refresh(true).catch(() => []);
    };
    globalThis.document?.addEventListener("visibilitychange", onVisible);
    this.$own(() => globalThis.document?.removeEventListener("visibilitychange", onVisible));

    return this.refresh().catch(() => []);
  },

  _setSources(items: readonly NotificationSource[]) {
    const next = new Map<string, SourceEntry>();
    for (const item of items) {
      if (typeof item.id !== "string" || item.id === "" || typeof item.list !== "function") continue;
      next.set(item.id, { list: item.list.bind(item), retain: item.retain === true });
    }
    this._sources = next;
  },

  /**
   * Ask every source again and rebuild the inbox. Coalesced: a caller landing
   * while a run is going gets the one run that starts when it ends, shared with
   * everybody else who landed meanwhile, since the run going may have read a
   * source before whatever the caller is reacting to changed it.
   */
  refresh(force = false): Promise<NotificationRecord[]> {
    if (!this._inflight || force) return this._start(force);
    return (this._trailing ??= this._inflight.catch(() => []).then(() => {
      this._trailing = null;
      return this._start(false);
    }));
  },

  _start(force: boolean): Promise<NotificationRecord[]> {
    this.pending = true;
    const run = this._run(force).finally(() => {
      if (this._inflight !== run) return;
      this._inflight = null;
      this.pending = false;
    });
    this._inflight = run;
    return run;
  },

  async _run(force: boolean): Promise<NotificationRecord[]> {
    const now = Date.now();
    const sources = [...this._sources.values()];
    const answers = await Promise.all(
      sources.map((source) =>
        Promise.resolve()
          .then(() => source.list({ force, now }))
          .then((rows) => (Array.isArray(rows) ? rows : []))
          .catch(() => []),
      ),
    );

    const firstLook = this.seenIds.length === 0;
    const fresh = new Set<string>();
    const groups: NotificationRecord[][] = [];
    for (const [index, source] of sources.entries()) {
      const rows = answers[index];
      if (!source.retain) {
        groups.push(rows);
        continue;
      }
      const next = takeNew({ seenIds: this.seenIds, news: this.news }, rows, now);
      if (next.changed) {
        this.seenIds = next.seenIds;
        this.news = next.news;
      }
      for (const row of next.fresh) fresh.add(row.id);
      groups.push(next.news);
    }

    const inbox = mergeInbox(groups, this.readIds);
    this.inbox = inbox;
    this.unread = unreadCount(inbox);
    const arrived = firstLook ? [] : inbox.filter((row) => fresh.has(row.id) && !row.read);
    if (arrived.length) this.arrived = arrived;
    return inbox;
  },

  /** Whether this device has read `id`. */
  isRead(id: string): boolean {
    return this.readIds.includes(id);
  },

  /** Mark one line read on this device. */
  markRead(id: string) {
    if (!id || this.readIds.includes(id)) return;
    this.readIds = [...this.readIds, id];
    this.inbox = this.inbox.map((row) => (row.id === id ? { ...row, read: true } : row));
    this.unread = unreadCount(this.inbox);
  },

  /** Mark every line in the inbox read on this device. */
  markAllRead() {
    this.readIds = [...new Set([...this.readIds, ...this.inbox.map((row) => row.id)])];
    this.inbox = this.inbox.map((row) => ({ ...row, read: true }));
    this.unread = 0;
  },
});

export default notifications;
export { notifications };
