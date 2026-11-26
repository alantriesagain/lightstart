/**
 * @file Reading a feed: the bare list and the envelope, anything else as an
 * empty feed, id-less rows dropped, expiry, and the community filter.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import type { NotificationRecord } from "../types.ts";
import { filterFeed, parseFeed } from "../lib/feed.ts";

const row = (extra: Partial<NotificationRecord>): NotificationRecord => ({
  id: "a",
  type: "t",
  title: "T",
  body: "",
  icon: "bell",
  url: "/",
  community: "",
  createdAt: "2026-09-18T00:00:00.000Z",
  ...extra,
});

const text = (rows: NotificationRecord[]): string => JSON.stringify(rows);

eq(
  "reads the bare list a baked file carries and the envelope an endpoint answers",
  text(parseFeed([row({})])) + text(parseFeed({ notifications: [row({})] })),
  text([row({})]) + text([row({})]),
);

const empties: Array<[string, unknown]> = [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["zero", 0],
  ["an object with no notifications", {}],
  ["a null notifications", { notifications: null }],
  ["a notifications that is not a list", { notifications: "no" }],
];
for (const [label, raw] of empties)
  eq(`anything else is an empty feed: ${label}`, text(parseFeed(raw)), "[]");

eq(
  "a row with no id is dropped, since nobody could decide whether they had seen it",
  text(parseFeed([row({ id: "" }), null, "x", row({ id: "b" })])),
  text([row({ id: "b" })]),
);
eq("an id has to be a string to go in a set of them", text(parseFeed([{ id: 7 }])), "[]");

const now = Date.parse("2026-09-18T12:00:00.000Z");
const live = row({ id: "live", expiresAt: "2026-09-18T18:00:00.000Z" });
const gone = row({ id: "gone", expiresAt: "2026-09-18T06:00:00.000Z" });
eq(
  "an expired row is not shown, and one with no deadline never expires",
  text(filterFeed([live, gone, row({ id: "forever" })], { now })),
  text([live, row({ id: "forever" })]),
);

const mine = row({ id: "mine", community: "rio" });
const theirs = row({ id: "theirs", community: "sp" });
eq(
  "a community filter is applied when the app runs as one",
  text(filterFeed([mine, theirs], { inCommunity: (r) => r.community === "rio" })),
  text([mine]),
);
eq("and skipped otherwise", text(filterFeed([mine, theirs])), text([mine, theirs]));

done();
