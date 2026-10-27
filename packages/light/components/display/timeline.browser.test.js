import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { html } from "@bootstrapp/light/html";
import View from "@bootstrapp/light";

const { default: timelineDef } = await import("./timeline.js");
const { default: linkDef } = await import("./link.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @param {string[]} names */
const loadStyles = async (...names) => {
  const css = (await Promise.all(names.map(async (name) =>
    (await fetch(new URL(`./${name}.css`, import.meta.url))).text()))).join("\n");
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  await tick();
};

/** @param {Date} date */
const dayOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** @param {number} offset @param {number} hour */
const localAt = (offset, hour) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour);
};

/** @param {string} at @param {string} locale */
const timeText = (at, locale) => new Date(at).toLocaleTimeString(locale, { timeStyle: "short" });

/** @param {Element} el */
const titlesOf = (el) => [...el.querySelectorAll(".timeline-title")].map((title) => title.textContent);

/** @param {Element} el */
const daysOf = (el) => [...el.querySelectorAll("section.timeline-day")].map((section) => section.getAttribute("data-day"));

/** @param {Element} el @param {string} day */
const sectionOf = (el, day) => el.querySelector(`section.timeline-day[data-day="${day}"]`);

/** @param {Element} el @param {string} title */
const entryTitled = (el, title) =>
  [...el.querySelectorAll("li.timeline-entry")].find((li) => li.querySelector(".timeline-title")?.textContent === title);

/** @type {Element[]} */
const mounted = [];

/**
 * @param {Record<string, unknown>} [props]
 * @param {Element} [parent]
 */
const mount = async (props = {}, parent = document.body) => {
  const el = /** @type {HTMLElement & { entries: unknown[], oldestFirst: boolean, extra: unknown, $requestUpdate: () => Promise<unknown> }} */ (
    Object.assign(document.createElement("lc-timeline"), props)
  );
  parent.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {string} dir */
const container = (dir) => {
  const box = document.createElement("div");
  box.dir = dir;
  box.style.width = "400px";
  document.body.append(box);
  mounted.push(box);
  return box;
};

describe("@bootstrapp/light - lc-timeline", () => {
  const lang = document.documentElement.lang;

  before(async () => {
    if (!customElements.get("lc-timeline")) View.define("lc-timeline", timelineDef);
    if (!customElements.get("lc-link")) View.define("lc-link", linkDef);
    await loadStyles("timeline");
    document.documentElement.lang = "en";
  });

  after(() => {
    document.documentElement.lang = lang;
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    document.documentElement.lang = "en";
    await tick();
  });

  it("draws an entry as a dot, its time, its title and a body that keeps its line break", async () => {
    const at = "2026-10-27T09:30:00Z";
    const el = await mount({ entries: [{ at, title: "Deploy finished", body: "Build 412\nto production" }] });
    assert.equal(el.querySelectorAll("li.timeline-entry").length, 1);
    const marker = el.querySelector(".timeline-marker");
    assert.equal(marker.children.length, 0, "a dot holds nothing");
    assert.ok(marker.getBoundingClientRect().width > 0);
    const time = el.querySelector("time.timeline-time");
    assert.equal(time.getAttribute("datetime"), at);
    assert.equal(time.textContent, timeText(at, "en"));
    assert.equal(el.querySelector("span.timeline-title").textContent, "Deploy finished");
    const body = el.querySelector(".timeline-body");
    assert.equal(body.textContent, "Build 412\nto production");
    const range = document.createRange();
    range.selectNodeContents(body);
    const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
    assert.equal(tops.size, 2, "two rendered lines");
  });

  it("draws an icon in the marker and colours each marker by its variant", async () => {
    const el = await mount({
      entries: [
        { at: "2026-10-27T10:00:00Z", title: "passed", icon: "check", variant: "success" },
        { at: "2026-10-27T09:00:00Z", title: "failed", variant: "danger" },
      ],
    });
    const success = entryTitled(el, "passed");
    const danger = entryTitled(el, "failed");
    assert.equal(success.getAttribute("data-variant"), "success");
    assert.equal(success.querySelector(".timeline-marker lc-icon").getAttribute("name"), "check");
    assert.equal(danger.querySelector(".timeline-marker lc-icon"), null);
    const successColor = getComputedStyle(success.querySelector(".timeline-marker")).backgroundColor;
    const dangerColor = getComputedStyle(danger.querySelector(".timeline-marker")).backgroundColor;
    assert.notEqual(successColor, dangerColor);
    assert.equal(successColor, "rgb(21, 128, 61)");
    assert.equal(dangerColor, "rgb(220, 38, 38)");
  });

  it("links a title through lc-link, and an absolute url opens in a new tab", async () => {
    const el = await mount({
      entries: [
        { at: "2026-10-27T10:00:00Z", title: "Order 42", href: "/orders/42" },
        { at: "2026-10-27T09:00:00Z", title: "Elsewhere", href: "https://example.com/x" },
        { at: "2026-10-27T08:00:00Z", title: "Plain" },
      ],
    });
    const [internal, external] = /** @type {Array<HTMLElement & { $requestUpdate: () => Promise<unknown> }>} */ ([...el.querySelectorAll("lc-link.timeline-title")]);
    await internal.$requestUpdate();
    await external.$requestUpdate();
    assert.equal(internal.getAttribute("href"), "/orders/42");
    assert.equal(internal.getAttribute("label"), "Order 42");
    assert.equal(internal.hasAttribute("external"), false);
    assert.equal(internal.querySelector("a").hasAttribute("target"), false);
    assert.equal(external.getAttribute("href"), "https://example.com/x");
    assert.equal(external.hasAttribute("external"), true);
    assert.equal(external.querySelector("a").getAttribute("target"), "_blank");
    assert.equal(entryTitled(el, "Plain").querySelector(".timeline-title").tagName, "SPAN");
  });

  it("draws what the extra function returns under each entry, and redraws when it changes", async () => {
    const entries = [
      { at: "2026-10-27T10:00:00Z", title: "one", body: "first" },
      { at: "2026-10-27T09:00:00Z", title: "two", body: "second" },
      { at: "2026-10-27T08:00:00Z", title: "three", body: "third" },
    ];
    const plain = await mount({ entries });
    assert.equal(plain.querySelector(".timeline-extra"), null, "no extra, no region");

    const el = await mount({ entries, extra: (/** @type {{ title: string }} */ entry) => html`<lc-badge>${entry.title}</lc-badge>` });
    for (const li of el.querySelectorAll("li.timeline-entry")) {
      const badges = li.querySelectorAll("lc-badge");
      assert.equal(badges.length, 1);
      assert.equal(badges[0].textContent, li.querySelector(".timeline-title").textContent);
      assert.ok(badges[0].closest(".timeline-extra").getBoundingClientRect().top >= li.querySelector(".timeline-body").getBoundingClientRect().bottom - 1, "the extra sits under the body");
    }

    el.extra = () => html`<button class="undo">Undo</button>`;
    await el.$requestUpdate();
    assert.equal(el.querySelectorAll("lc-badge").length, 0);
    assert.equal(el.querySelectorAll(".timeline-extra button.undo").length, 3);

    el.extra = null;
    await el.$requestUpdate();
    assert.equal(el.querySelector(".timeline-extra"), null);
  });

  it("draws markup in a title or body as text", async () => {
    const title = "<img src=x onerror=\"window.pwned=1\">";
    const el = await mount({ entries: [{ at: "2026-10-27T09:00:00Z", title, body: "<b>bold</b>" }] });
    await tick();
    assert.equal(document.querySelector("lc-timeline img"), null);
    assert.equal(document.querySelector("lc-timeline b"), null);
    assert.equal(el.querySelector(".timeline-title").textContent, title);
    assert.equal(el.querySelector(".timeline-body").textContent, "<b>bold</b>");
    assert.equal("pwned" in window, false);
  });

  it("puts the line and the markers on the inline start, the right in rtl and the left in ltr", async () => {
    const entries = [
      { at: "2026-10-27T10:00:00Z", title: "one" },
      { at: "2026-10-27T09:00:00Z", title: "two" },
      { at: "2026-10-26T09:00:00Z", title: "three" },
    ];
    const rtl = await mount({ entries }, container("rtl"));
    const ltr = await mount({ entries }, container("ltr"));
    const rtlBox = rtl.getBoundingClientRect();
    const ltrBox = ltr.getBoundingClientRect();
    assert.equal(rtlBox.width, ltrBox.width);
    assert.ok(rtlBox.width > 0);

    for (const list of rtl.querySelectorAll("ol.timeline-list")) {
      const style = getComputedStyle(list);
      assert.ok(parseFloat(style.borderRightWidth) > 0, "the line is the right border");
      assert.equal(parseFloat(style.borderLeftWidth), 0);
      assert.ok(list.getBoundingClientRect().right - parseFloat(style.borderRightWidth) >= rtlBox.right - rtlBox.width / 4);
    }
    for (const marker of rtl.querySelectorAll(".timeline-marker")) {
      assert.ok(marker.getBoundingClientRect().left >= rtlBox.right - rtlBox.width / 4);
      assert.ok(marker.getBoundingClientRect().right <= rtlBox.right + 1);
    }

    for (const list of ltr.querySelectorAll("ol.timeline-list")) {
      const style = getComputedStyle(list);
      assert.ok(parseFloat(style.borderLeftWidth) > 0, "the line is the left border");
      assert.equal(parseFloat(style.borderRightWidth), 0);
      assert.ok(list.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) <= ltrBox.left + ltrBox.width / 4);
    }
    for (const marker of ltr.querySelectorAll(".timeline-marker")) {
      assert.ok(marker.getBoundingClientRect().right <= ltrBox.left + ltrBox.width / 4);
      assert.ok(marker.getBoundingClientRect().left >= ltrBox.left - 1);
    }
  });

  it("draws one headed list per day, and nothing at all with no entries", async () => {
    const entries = [
      { at: new Date(2026, 9, 25, 10).toISOString(), title: "a" },
      { at: new Date(2026, 9, 26, 14).toISOString(), title: "b" },
      { at: new Date(2026, 9, 26, 9).toISOString(), title: "c" },
      { at: new Date(2026, 9, 27, 8).toISOString(), title: "d" },
    ];
    const el = await mount({ entries });
    const headings = [...el.querySelectorAll("h2.timeline-day-title")];
    assert.equal(headings.length, 3);
    assert.deepEqual(headings.map((h2) => h2.querySelector("time").getAttribute("datetime")), ["2026-10-27", "2026-10-26", "2026-10-25"]);
    const expected = [["d"], ["b", "c"], ["a"]];
    headings.forEach((h2, index) => {
      const list = h2.nextElementSibling;
      assert.equal(list.tagName, "OL");
      assert.equal(h2.parentElement.querySelectorAll("ol").length, 1);
      assert.deepEqual([...list.children].map((li) => li.querySelector(".timeline-title").textContent), expected[index]);
    });

    const empty = await mount({ entries: [] });
    assert.equal(empty.children.length, 0);
    assert.equal(empty.textContent.trim(), "");

    el.entries = [];
    await el.$requestUpdate();
    assert.equal(el.querySelector("section, h2, ol, li"), null);
    assert.equal(el.textContent.trim(), "");
  });

  it("heads each day with today, yesterday and tomorrow in words, and other days by weekday and date", async () => {
    const today = dayOf(new Date());
    const yesterday = dayOf(localAt(-1, 12));
    const tomorrow = dayOf(localAt(1, 12));
    const entries = [today, yesterday, tomorrow, "2026-03-03", "2025-03-03"].map((at) => ({ at, title: at }));
    const year = today.slice(0, 4);
    /** @param {string} day @param {string} locale */
    const dateWords = (day, locale) => {
      const [y, m, d] = day.split("-").map(Number);
      /** @type {Intl.DateTimeFormatOptions} */
      const options = { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" };
      if (day.slice(0, 4) !== year) options.year = "numeric";
      return new Intl.DateTimeFormat(locale, options).format(Date.UTC(y, m - 1, d));
    };
    /** @param {Element} el @param {string} day */
    const heading = (el, day) => sectionOf(el, day).querySelector("h2 time").textContent;

    const en = await mount({ entries });
    assert.equal(heading(en, today), "Today");
    assert.equal(heading(en, yesterday), "Yesterday");
    assert.equal(heading(en, tomorrow), "Tomorrow");
    assert.equal(heading(en, "2026-03-03"), dateWords("2026-03-03", "en"));
    assert.equal(heading(en, "2025-03-03"), dateWords("2025-03-03", "en"));
    assert.match(heading(en, "2025-03-03"), /2025/);

    document.documentElement.lang = "pt";
    const pt = await mount({ entries });
    assert.equal(heading(pt, today), "Hoje");
    assert.equal(heading(pt, yesterday), "Ontem");
    assert.equal(heading(pt, tomorrow), "Amanhã");
  });

  it("draws the newest day and entry first, and oldest first when the oldest-first attribute is set", async () => {
    const entries = [
      { at: localAt(0, 11).toISOString(), title: "11:00" },
      { at: localAt(-1, 12).toISOString(), title: "yesterday" },
      { at: localAt(0, 9).toISOString(), title: "09:00" },
      { at: localAt(0, 15).toISOString(), title: "15:00" },
    ];
    const today = dayOf(localAt(0, 12));
    const yesterday = dayOf(localAt(-1, 12));
    const el = await mount({ entries });
    assert.deepEqual(daysOf(el), [today, yesterday]);
    assert.deepEqual(titlesOf(sectionOf(el, today)), ["15:00", "11:00", "09:00"]);

    el.setAttribute("oldest-first", "");
    await el.$requestUpdate();
    assert.deepEqual(daysOf(el), [yesterday, today]);
    assert.deepEqual(titlesOf(sectionOf(el, today)), ["09:00", "11:00", "15:00"]);

    el.removeAttribute("oldest-first");
    await el.$requestUpdate();
    assert.deepEqual(daysOf(el), [today, yesterday]);
  });

  it("draws oldest first when the oldestFirst property is set", async () => {
    const entries = [
      { at: localAt(0, 11).toISOString(), title: "11:00" },
      { at: localAt(-1, 12).toISOString(), title: "yesterday" },
      { at: localAt(0, 9).toISOString(), title: "09:00" },
      { at: localAt(0, 15).toISOString(), title: "15:00" },
    ];
    const today = dayOf(localAt(0, 12));
    const yesterday = dayOf(localAt(-1, 12));
    const assigned = await mount({ entries, oldestFirst: true });
    assert.deepEqual(daysOf(assigned), [yesterday, today]);
    assert.deepEqual(titlesOf(sectionOf(assigned, today)), ["09:00", "11:00", "15:00"]);

    const el = await mount({ entries });
    el.oldestFirst = true;
    await el.$requestUpdate();
    assert.deepEqual(daysOf(el), [yesterday, today]);
    assert.deepEqual(titlesOf(sectionOf(el, today)), ["09:00", "11:00", "15:00"]);
  });

  it("files an instant under the reader's calendar day, and a date alone under its own day with no time", async () => {
    const early = "2026-10-27T01:30:00Z";
    const late = "2026-10-27T23:30:00Z";
    const el = await mount({
      entries: [
        { at: early, title: "early" },
        { at: late, title: "late" },
        { at: "2026-10-27", title: "date only" },
      ],
    });
    for (const at of [early, late]) {
      const time = el.querySelector(`time.timeline-time[datetime="${at}"]`);
      assert.equal(time.closest("section").getAttribute("data-day"), dayOf(new Date(at)));
      assert.equal(time.textContent, timeText(at, "en"));
    }
    const dateOnly = entryTitled(el, "date only");
    assert.equal(dateOnly.closest("section").getAttribute("data-day"), "2026-10-27");
    assert.equal(dateOnly.querySelector("time"), null);
  });

  it("keeps entries at the same moment in input order, and draws an unreadable one last with no heading or time", async () => {
    const entries = [
      { at: "2026-10-20T09:00:00Z", title: "earlier" },
      { at: "2026-10-27T09:00:00Z", title: "first" },
      { at: "not a date", title: "unreadable" },
      { at: "2026-10-27T09:00:00Z", title: "second" },
    ];
    for (const oldestFirst of [false, true]) {
      const el = await mount({ entries, oldestFirst });
      const titles = titlesOf(el);
      assert.equal(titles.indexOf("second"), titles.indexOf("first") + 1, "the tie keeps input order");
      const sections = [...el.querySelectorAll("section.timeline-day")];
      const last = sections.at(-1);
      assert.deepEqual(titlesOf(last), ["unreadable"]);
      assert.equal(last.hasAttribute("data-day"), false);
      assert.equal(last.querySelector("h2"), null);
      assert.equal(last.querySelector("time"), null);
      assert.equal(titles.at(-1), "unreadable");
    }
  });

  it("draws a thousand entries in one update", async () => {
    const start = Date.now();
    const span = 60 * 86400e3;
    const entries = Array.from({ length: 1000 }, (_, index) => ({
      at: new Date(start - Math.floor((index * span) / 1000)).toISOString(),
      title: `entry ${index}`,
      body: "something happened",
    }));
    const el = await mount();
    el.entries = entries;
    await el.$requestUpdate();
    assert.equal(el.querySelectorAll("li.timeline-entry").length, 1000);
  });
});
