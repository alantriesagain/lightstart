/// <reference lib="dom" />
/**
 * @file The `notifications` controller over the source slot: merging, the
 * coalesced refresh, a throwing source, retain, seen ids, arrived, read state
 * across instances, and withdrawing a fill.
 */

import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { nameControllers, registerAdapter } from "@lightstart/light/controller";
import { localStorage as localAdapter } from "@lightstart/light/controller/storage";
import notifications from "../controllers/notifications.ts";
import { notificationSources } from "../page/sources.ts";

/** @import { NotificationRecord, NotificationSource } from "../types.ts" */

const KEYS = ["notifications:readIds", "notifications:seenIds", "notifications:news"];

const row = (/** @type {string} */ id, /** @type {Partial<NotificationRecord>} */ extra = {}) =>
  ({ id, type: "online", title: id, body: "", icon: "bell", url: "/meetups", community: "", createdAt: new Date().toISOString(), ...extra });

const json = (/** @type {unknown} */ value) => JSON.stringify(value);

/** @type {Array<() => void>} */
const offs = [];

/**
 * @param {string} id
 * @param {NotificationSource["list"]} list
 * @param {boolean} [retain]
 */
const fill = (id, list, retain = false) => {
  const off = notificationSources.fill({ id, list, retain });
  offs.push(off);
  return off;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("@lightstart/notifications - notifications", () => {
  before(() => {
    registerAdapter("local", localAdapter);
    nameControllers([notifications]);
  });

  beforeEach(async () => {
    await notifications.$ready;
  });

  afterEach(async () => {
    for (const off of offs.splice(0)) off();
    await notifications.dispose();
    for (const key of KEYS) globalThis.localStorage.removeItem(key);
  });

  it("merges every filled source into one list, newest first", async () => {
    const inbox = notifications;
    fill("a", () => [row("a", { createdAt: "2026-09-17T00:00:00.000Z" })]);
    fill("b", () => [row("b", { createdAt: "2026-09-18T00:00:00.000Z" })]);
    await inbox.refresh(true);

    assert.equal(json(inbox.inbox.map((n) => n.id)), json(["b", "a"]));
    assert.equal(inbox.unread, 2);
  });

  it("a run that ends first leaves a newer forced run pending and in flight", async () => {
    const inbox = notifications;
    /** @type {Array<() => void>} */
    const holds = [];
    const answer = () => /** @type {() => void} */ (holds.shift())();
    fill("slow", () => new Promise((resolve) => holds.push(() => resolve([row("slow")]))));
    await tick();
    while (holds.length) answer();
    await tick();
    const first = inbox.refresh(true);
    const second = inbox.refresh(true);
    await tick();
    assert.equal(holds.length, 2);
    answer();
    await first;
    assert.equal(inbox.pending, true, "the newer run is still going");
    const plain = inbox.refresh();
    assert.notEqual(plain, second, "the run going may have read the sources before the caller's change");
    assert.equal(inbox.refresh(), plain, "everybody landing meanwhile shares the one run after it");
    answer();
    await second;
    await tick();
    assert.equal(holds.length, 1, "which asks the sources again once the run going ends");
    assert.equal(inbox.pending, true);
    answer();
    await plain;
    assert.equal(inbox.pending, false);
  });

  it("a source that throws contributes nothing and takes nobody else down", async () => {
    const inbox = notifications;
    fill("broken", () => { throw new Error("no"); });
    fill("fine", () => [row("fine")]);
    await inbox.refresh(true);

    assert.equal(json(inbox.inbox.map((n) => n.id)), json(["fine"]));
  });

  it("a retaining source's line survives the source no longer carrying it", async () => {
    const inbox = notifications;
    let live = [row("online:p1:10")];
    fill("live", () => live, true);
    await inbox.refresh(true);
    assert.equal(json(inbox.inbox.map((n) => n.id)), json(["online:p1:10"]));

    live = [];
    await inbox.refresh(true);
    assert.equal(json(inbox.inbox.map((n) => n.id)), json(["online:p1:10"]), "the status ended; the line stays");
  });

  it("a plain source's line does not, because it answers what exists", async () => {
    const inbox = notifications;
    let feed = [row("announcement")];
    fill("feed", () => feed);
    await inbox.refresh(true);
    assert.equal(inbox.inbox.length, 1);

    feed = [];
    await inbox.refresh(true);
    assert.equal(json(inbox.inbox), json([]));
  });

  it("an id shown once is not new again, per device", async () => {
    const inbox = notifications;
    fill("live", () => [row("a")], true);
    await inbox.refresh(true);
    assert.equal(json(JSON.parse(globalThis.localStorage.getItem("notifications:seenIds") ?? "[]")), json(["a"]));

    inbox.markAllRead();
    assert.equal(inbox.unread, 0);
    await inbox.refresh(true);
    assert.equal(inbox.unread, 0, "reading it is remembered across a refresh");
  });

  it("says what arrived: a retaining source's new lines, never the first look", async () => {
    const inbox = notifications;
    let live = [row("online:p1:10")];
    let feed = [row("announcement")];
    fill("live", () => live, true);
    fill("feed", () => feed);
    await inbox.refresh(true);
    assert.equal(inbox.arrived.length, 0, "everything is new to a device that never looked, and none of it just happened");

    live = [row("online:p1:10"), row("alert:asked:r1", { createdAt: new Date(Date.now() + 1000).toISOString() })];
    feed = [row("announcement"), row("announcement-2")];
    await inbox.refresh(true);
    assert.equal(json(inbox.arrived.map((n) => n.id)), json(["alert:asked:r1"]), "the feed answers what exists, so nothing in it arrives");

    const found = inbox.arrived;
    await inbox.refresh(true);
    assert.equal(inbox.arrived, found, "a refresh that finds nothing new leaves it as it was");

    live = [...live, row("alert:accepted:r2")];
    inbox.markAllRead();
    await inbox.refresh(true);
    assert.equal(json(inbox.arrived.map((n) => n.id)), json(["alert:accepted:r2"]));
  });

  it("read state is stored per device and survives a new instance", async () => {
    const inbox = notifications;
    fill("feed", () => [row("a"), row("b")]);
    await inbox.refresh(true);
    inbox.markRead("a");
    assert.equal(inbox.unread, 1);
    assert.equal(json(JSON.parse(globalThis.localStorage.getItem("notifications:readIds") ?? "[]")), json(["a"]));

    inbox.dispose();
    const next = notifications;
    fill("feed", () => [row("a"), row("b")]);
    await next.refresh(true);
    assert.equal(json(next.inbox.map((n) => [n.id, n.read])), json([["a", true], ["b", false]]));
  });

  it("registering a source refreshes, and taking it back out drops its lines", async () => {
    const inbox = notifications;
    const off = fill("feed", () => [row("a")]);
    await inbox.$ready;
    await inbox.refresh(true);
    assert.equal(inbox.inbox.length, 1);

    off();
    await inbox.refresh(true);
    assert.equal(json(inbox.inbox), json([]));
  });

  it("a fill with no id or no list is ignored", async () => {
    const inbox = notifications;
    offs.push(notificationSources.fill(/** @type {NotificationSource} */ (/** @type {unknown} */ ({ id: "", list: () => [] }))));
    offs.push(notificationSources.fill(/** @type {NotificationSource} */ (/** @type {unknown} */ ({ id: "broken" }))));
    await inbox.refresh(true);
    assert.equal(json(inbox.inbox), json([]));
  });
});
