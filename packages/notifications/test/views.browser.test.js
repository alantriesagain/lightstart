/**
 * @file The notifications views: the bell's count and label, the list and its
 * empty state, a row's hand-off to lc-list-row, marking read before the host
 * hears, and the sheet's slot and close.
 */

/// <reference lib="dom" />
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";
import { nameControllers, registerAdapter } from "@lightstart/light/controller";
import { localStorage as localAdapter } from "@lightstart/light/controller/storage";
import { syncPlugin } from "@lightstart/light/controller/view";
import badgeDef from "@lightstart/components/display/badge.js";
import buttonDef from "@lightstart/components/display/button.js";
import emptyStateDef from "@lightstart/components/feedback/empty-state.js";
import listRowDef from "@lightstart/components/display/list-row.js";
import textDef from "@lightstart/components/display/text.js";
import bottomSheetDef from "@lightstart/components/overlay/bottom-sheet.js";
import notifications from "../controllers/notifications.ts";
import { notificationSources } from "../page/sources.ts";
import bellDef from "../views/bell.js";
import listDef from "../views/list.js";
import rowDef from "../views/row.js";
import sheetDef from "../views/sheet.js";

/** @import { NotificationRecord } from "../types.ts" */

/** @typedef {HTMLElement & { $requestUpdate(): Promise<unknown> }} LightElement */
/** @typedef {LightElement & { item: NotificationRecord | null }} RowElement */
/** @typedef {LightElement & { open: boolean }} SheetElement */

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/**
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @returns {Promise<LightElement>}
 */
const mount = async (tag, attrs = {}) => {
  const el = /** @type {LightElement} */ (document.createElement(tag));
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

const row = (/** @type {string} */ id, /** @type {Partial<NotificationRecord>} */ extra = {}) =>
  ({ id, type: "online", title: id, body: "somewhere", icon: "user-round", url: "/meetups", community: "", createdAt: new Date().toISOString(), ...extra });

/** @type {Array<() => void>} */
const sources = [];

/** @param {NotificationRecord[]} rows */
const feed = async (rows) => {
  sources.push(notificationSources.fill({ id: "feed", list: () => rows }));
  await notifications.refresh(true);
};

/** @param {Element} root @param {string} selector */
const one = (root, selector) => /** @type {Element} */ (root.querySelector(selector));

describe("@lightstart/notifications - views", () => {
  before(async () => {
    registerAdapter("local", localAdapter);
    nameControllers([notifications]);
    View.use(syncPlugin);
    if (!customElements.get("notifications-bell")) View.define("notifications-bell", bellDef);
    if (!customElements.get("notifications-list")) View.define("notifications-list", listDef);
    if (!customElements.get("notifications-row")) View.define("notifications-row", rowDef);
    if (!customElements.get("notifications-sheet")) View.define("notifications-sheet", sheetDef);
    if (!customElements.get("lc-badge")) View.define("lc-badge", badgeDef);
    if (!customElements.get("lc-button")) View.define("lc-button", buttonDef);
    if (!customElements.get("lc-empty-state")) View.define("lc-empty-state", emptyStateDef);
    if (!customElements.get("lc-list-row")) View.define("lc-list-row", listRowDef);
    if (!customElements.get("lc-text")) View.define("lc-text", textDef);
    if (!customElements.get("lc-bottom-sheet")) View.define("lc-bottom-sheet", bottomSheetDef);
    await notifications.$ready;
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    for (const off of sources.splice(0)) off();
    notifications.readIds = [];
    notifications.seenIds = [];
    notifications.news = [];
    notifications.arrived = [];
    notifications.inbox = [];
    notifications.unread = 0;
    for (const key of ["notifications:readIds", "notifications:seenIds", "notifications:news"]) globalThis.localStorage.removeItem(key);
    await notifications.refresh(true);
    await tick();
  });

  it("the bell carries how many are unread, and nothing once they are read", async () => {
    const bell = await mount("notifications-bell");
    assert.equal(bell.querySelector("lc-badge"), null, "an empty inbox says nothing");
    assert.ok(bell.querySelector("lc-button[icon=bell]"));
    assert.equal(one(bell, "lc-button").getAttribute("aria-label"), "Inbox");

    await feed([row("a"), row("b"), row("c")]);
    await bell.$requestUpdate();
    assert.equal(one(bell, "lc-badge[data-count][corner]").textContent?.trim(), "3");
    assert.equal(one(bell, "lc-button").getAttribute("aria-label"), "Inbox, 3 unread");

    notifications.markAllRead();
    await bell.$requestUpdate();
    assert.equal(bell.querySelector("lc-badge"), null);
  });

  it("draws the glyph its host names, and keeps the inbox's label", async () => {
    const bell = await mount("notifications-bell", { icon: "inbox" });
    assert.ok(bell.querySelector("lc-button[icon=inbox]"));
    assert.equal(bell.querySelector("lc-button[icon=bell]"), null);
    assert.equal(one(bell, "lc-button").getAttribute("aria-label"), "Inbox");

    await feed([row("a"), row("b")]);
    await bell.$requestUpdate();
    assert.equal(one(bell, "lc-badge[data-count]").textContent?.trim(), "2", "the count rides whatever it draws");
    assert.equal(one(bell, "lc-button").getAttribute("aria-label"), "Inbox, 2 unread");
  });

  it("the count stops at 9+", async () => {
    const bell = await mount("notifications-bell");
    await feed(Array.from({ length: 12 }, (_, i) => row(`n${String(i)}`)));
    await bell.$requestUpdate();
    assert.equal(one(bell, "lc-badge[data-count]").textContent?.trim(), "9+");
  });

  it("the bell opens nothing itself: it asks its host to", async () => {
    const bell = await mount("notifications-bell");
    let opened = 0;
    bell.addEventListener("open", () => opened++);
    /** @type {HTMLElement} */ (one(bell, "lc-button")).click();
    assert.equal(opened, 1);
  });

  it("the list draws one row per line, and an empty state when there are none", async () => {
    const list = await mount("notifications-list");
    assert.ok(list.querySelector("lc-empty-state"));

    await feed([row("a"), row("b")]);
    await list.$requestUpdate();
    assert.equal(list.querySelectorAll("notifications-row").length, 2);
    assert.equal(list.querySelector("lc-empty-state"), null);
  });

  it("mark-all-read shows only when asked for and only while something is unread", async () => {
    await feed([row("a")]);
    const plain = await mount("notifications-list");
    assert.equal(plain.querySelector("lc-button"), null, "a list that was not asked to offer it does not");

    const list = await mount("notifications-list", { "read-all": "" });
    const button = /** @type {HTMLElement} */ (list.querySelector("lc-button"));
    assert.ok(button);

    button.click();
    await list.$requestUpdate();
    assert.equal(notifications.unread, 0);
    assert.equal(list.querySelector("lc-button"), null, "and it goes once there is nothing left to mark");
  });

  it("a row hands lc-list-row the line, unread until it is read", async () => {
    const view = /** @type {RowElement} */ (await mount("notifications-row"));
    view.item = row("a", { title: "Ana asked to join", body: "Beach in Ipanema" });
    await view.$requestUpdate();

    const drawn = one(view, "lc-list-row");
    assert.equal(drawn.getAttribute("label"), "Ana asked to join");
    assert.equal(drawn.getAttribute("hint"), "Beach in Ipanema");
    assert.equal(drawn.getAttribute("href"), "/meetups");
    assert.equal(drawn.getAttribute("data-notification"), "a");
    assert.equal(drawn.hasAttribute("unread"), true);
    assert.ok(drawn.getAttribute("meta"), "and says how long ago");

    view.item = row("a", { read: true });
    await view.$requestUpdate();
    assert.equal(one(view, "lc-list-row").hasAttribute("unread"), false);
  });

  it("a row with nothing to draw draws nothing", async () => {
    const view = await mount("notifications-row");
    assert.equal(view.querySelector("lc-list-row"), null);
  });

  it("picking a line marks it read before the host hears about it", async () => {
    await feed([row("a")]);
    const list = await mount("notifications-list");
    /** @type {Array<{ id: string, url: string }>} */
    const picked = [];
    list.addEventListener("select", (/** @type {Event} */ e) => {
      const event = /** @type {CustomEvent<{ id: string, url: string }>} */ (e);
      picked.push(event.detail);
    });

    one(list, "notifications-row").dispatchEvent(new CustomEvent("select", { detail: { id: "a", url: "/meetups" }, bubbles: false }));
    await tick();

    assert.equal(JSON.stringify(picked), JSON.stringify([{ id: "a", url: "/meetups" }]));
    assert.equal(notifications.isRead("a"), true);
  });

  it("the sheet opens, carries the list in its sheet slot, and closes on a pick", async () => {
    await feed([row("a")]);
    const sheet = /** @type {SheetElement} */ (await mount("notifications-sheet", { open: "" }));
    const bottom = one(sheet, "lc-bottom-sheet");
    assert.equal(bottom.hasAttribute("open"), true);
    const list = one(sheet, "notifications-list");
    assert.ok(list);
    const child = list.closest("[slot=sheet]");
    assert.ok(child, "lc-bottom-sheet projects only its slots, so the list has to be in one");
    assert.ok(bottom.contains(child), "and the slot belongs to the sheet");

    let closed = 0;
    sheet.addEventListener("sheet-closed", () => closed++);
    list.dispatchEvent(new CustomEvent("select", { detail: { id: "a", url: "/meetups" } }));
    await sheet.$requestUpdate();

    assert.equal(closed, 1);
    assert.equal(sheet.open, false);
  });

  it("the closed sheet draws no list", async () => {
    const sheet = await mount("notifications-sheet");
    assert.equal(sheet.querySelector("notifications-list"), null);
  });
});
