/**
 * @file The seen set and the inbox: an id shown once is not news again, a
 * retaining source's lines outlive the answer, both stores are capped, and the
 * merge is newest first with this device's read set.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import type { NotificationRecord } from "../types.ts";
import { mergeInbox, NEWS_KEPT, NEWS_LIFE_MS, SEEN_KEPT, takeNew, unreadCount } from "../lib/inbox.ts";

const NOW = Date.parse("2026-09-18T12:00:00.000Z");

const row = (id: string, extra: Partial<NotificationRecord> = {}): NotificationRecord => ({
  id,
  type: "online",
  title: id,
  body: "",
  icon: "bell",
  url: "/",
  community: "",
  createdAt: new Date(NOW).toISOString(),
  ...extra,
});

const ids = (rows: NotificationRecord[]): string => JSON.stringify(rows.map((n) => n.id));
const empty = { seenIds: [] as string[], news: [] as NotificationRecord[] };

const first = takeNew(empty, [row("a")], NOW);
eq("an id shown once is not news again: first news", ids(first.news), '["a"]');
eq("an id shown once is not news again: seen", JSON.stringify(first.seenIds), '["a"]');
eq("an id shown once is not news again: fresh", ids(first.fresh), '["a"]');
eq("an id shown once is not news again: changed", String(first.changed), "true");

const second = takeNew({ seenIds: first.seenIds, news: [] }, [row("a")], NOW);
eq("the same line a second time is not something that happened", ids(second.news), "[]");
eq("the same line a second time adds nothing fresh", ids(second.fresh), "[]");
eq("the same line a second time changes nothing", String(second.changed), "false");

const movedFirst = takeNew(empty, [row("online:p1:10:00")], NOW);
const moved = takeNew({ seenIds: movedFirst.seenIds, news: [] }, [row("online:p1:11:00")], NOW);
eq("the same person under a new id is news again, which is why an id moves", ids(moved.news), '["online:p1:11:00"]');
eq("a row with no id is ignored rather than counted as new every time", ids(takeNew(empty, [row("")], NOW).news), "[]");

const found = takeNew(empty, [row("a")], NOW);
const later = takeNew({ seenIds: found.seenIds, news: found.news }, [], NOW);
eq("what it found is kept after the source stops answering it", ids(later.news), '["a"]');
eq("a refresh that answers nothing new changes nothing", String(later.changed), "false");

const expired = takeNew({ seenIds: found.seenIds, news: found.news }, [], NOW + NEWS_LIFE_MS + 1);
eq("a kept line is dropped once it is no longer news", ids(expired.news), "[]");
eq("dropping a kept line is a change", String(expired.changed), "true");

const many = Array.from({ length: SEEN_KEPT + 10 }, (_, i) => row(`n${String(i)}`));
const capped = takeNew(empty, many, NOW);
eq("the seen set is capped", String(capped.seenIds.length), String(SEEN_KEPT));
eq("the newest id is the one that must not be forgotten", String(capped.seenIds.at(-1)), `n${String(many.length - 1)}`);
eq("the held news is capped", String(capped.news.length), String(NEWS_KEPT));

const older = row("older", { createdAt: "2026-09-17T00:00:00.000Z" });
const newer = row("newer", { createdAt: "2026-09-18T00:00:00.000Z" });
const inbox = mergeInbox([[older], [newer]], ["older"]);
eq("the inbox is one list, newest first", ids(inbox), '["newer","older"]');
eq("each line is marked read from this device's own set", JSON.stringify(inbox.map((n) => n.read)), "[false,true]");
eq("unread counts the lines this device has not read", String(unreadCount(inbox)), "1");

const twice = mergeInbox([[row("a", { title: "first" })], [row("a", { title: "second" })]], []);
eq("two sources naming one id are one line", String(twice.length), "1");
eq("the first to say it wins", twice[0]?.title ?? "", "first");

eq("a source that answers nothing contributes nothing", String(mergeInbox([[], []], []).length), "0");
eq("an empty inbox has nothing unread", String(unreadCount([])), "0");


done();
