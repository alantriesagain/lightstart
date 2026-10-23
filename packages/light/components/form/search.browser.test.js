import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";
import searchDef from "./search.js";
import joinDef from "./join.js";

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const loadSheet = (href) => new Promise((resolve) => {
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = href;
  sheet.onload = resolve;
  sheet.onerror = resolve;
  document.head.append(sheet);
});

const DOCS = [
  { id: "1", group: "Places", title: "Arpoador", hint: "Ipanema", href: "/places/arpoador" },
  { id: "2", group: "Places", title: "Arcos da Lapa", href: "/places/arcos" },
  { id: "3", group: "Events", title: "Baile na Lapa", href: "/events/baile" },
];

const RECENT = [{ id: "r1", group: "Recent", title: "arpoador" }];

/** @type {Element[]} */
const mounted = [];

const mount = async (props = {}) => {
  const el = /** @type {any} */ (document.createElement("lc-search"));
  for (const [key, value] of Object.entries(props))
    if (typeof value === "boolean") el.toggleAttribute(key, value);
    else el[key] = value;
  el.docs = props.docs ?? DOCS;
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

/** @param {any} el @param {string} value */
const type = async (el, value) => {
  const input = el.querySelector("input");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.$requestUpdate();
};

/** @param {any} el @param {string} key */
const press = async (el, key) => {
  el.querySelector("input").dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  await el.$requestUpdate();
};

/**
 * A result is a real link; on this page nothing routes, so the click would leave
 * the runner. The host's router intercepts anchors in an app; this stands in.
 * @param {Event} e
 */
const keepThePage = (e) => {
  if (/** @type {Element} */ (e.target).closest?.("a[href]")) e.preventDefault();
};

describe("@bootstrapp/light - lc-search", () => {
  before(async () => {
    document.addEventListener("click", keepThePage, true);
    if (!customElements.get("lc-join")) View.define("lc-join", joinDef);
    if (!customElements.get("lc-search")) View.define("lc-search", searchDef);
    await loadSheet(new URL("./join.css", import.meta.url).href);
    await loadSheet(new URL("./search.css", import.meta.url).href);
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  after(() => {
    document.body.innerHTML = "";
    document.removeEventListener("click", keepThePage, true);
  });

  it("stays a plain field when nothing is put beside it", async () => {
    const el = await mount();

    assert.equal(el.querySelector("lc-join"), null, "no join without a pane to join");
    assert.ok(el.querySelector("input"), "the field is there");
  });

  it("joins the field to whatever the host puts beside it", async () => {
    const el = await mount({ leading: () => "meetup.rio" });
    const join = el.querySelector("lc-join");

    assert.ok(join, "leading content makes it a join");
    assert.match(join.querySelector(".search-aside-body").textContent, /meetup\.rio/);
    assert.equal(join.children[0].className, "search-aside", "the pane leads");
    assert.ok(join.children[1].classList.contains("search-wrapper"), "the field follows it");
  });

  it("centres a pane's content on the field beside it, not on its baseline", async () => {
    const el = await mount({
      collapsible: true,
      leading: () => html`<a href="/" style="font-size:13px;line-height:1.2">meetup.rio</a>`,
    });
    el.style.cssText = "line-height:1.5;font-size:16px;--lc-search-height:50px";
    await el.$requestUpdate();

    const mid = (/** @type {Element} */ node) => {
      const box = node.getBoundingClientRect();
      return Math.round(box.top + box.height / 2);
    };
    assert.equal(mid(el.querySelector(".search-aside-body a")), mid(el.querySelector(".search-trigger")),
      "an inline pane sits on the line box's baseline unless the pane centres it");
  });

  it("gives a pane's glyphs room, descenders included", async () => {
    const el = await mount({
      collapsible: true,
      leading: () => html`<a href="/" style="font-size:15px;font-weight:900">meetup.rio</a>`,
    });
    el.style.cssText = "line-height:1;--lc-search-height:50px";
    await el.$requestUpdate();

    const body = /** @type {HTMLElement} */ (el.querySelector(".search-aside-body"));
    const a = /** @type {HTMLElement} */ (el.querySelector(".search-aside-body a"));
    const cs = getComputedStyle(a);
    const ctx = /** @type {CanvasRenderingContext2D} */ (document.createElement("canvas").getContext("2d"));
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(a.textContent || "");
    const ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;

    assert.ok(body.clientHeight >= ink,
      `the pane clips its own text: ${ink.toFixed(1)}px of ink in a ${body.clientHeight}px box that hides its overflow`);
  });

  it("puts a trailing pane after the field", async () => {
    const el = await mount({ trailing: () => "Go" });
    const join = el.querySelector("lc-join");

    assert.ok(join.children[0].classList.contains("search-wrapper"), "the field leads");
    assert.match(join.children[1].textContent, /Go/);
  });

  it("is an icon until it is asked to open", async () => {
    const el = await mount({ collapsible: true, leading: () => "meetup.rio" });

    assert.ok(el.querySelector(".search-trigger"), "collapsed, it is a button");
    assert.equal(el.querySelector("input"), null, "and there is no field to type into");

    el.querySelector(".search-trigger").click();
    await el.$requestUpdate();

    assert.ok(el.querySelector("input"), "clicking it opens the field");
    assert.equal(el.querySelector(".search-trigger"), null, "and the button is gone");
    assert.equal(el.getAttribute("expanded"), "", "the state reaches the host attribute");
    assert.equal(el.ownerDocument.activeElement, el.querySelector("input"), "with the caret already in it");
  });

  it("survives the focus it loses when the icon it was tapped on goes away", async () => {
    const el = await mount({ collapsible: true, leading: () => "brand" });
    const trigger = /** @type {HTMLElement} */ (el.querySelector(".search-trigger"));

    trigger.focus();
    trigger.click();
    await tick(50);
    await el.$requestUpdate();
    await tick(50);

    assert.equal(el.expanded, true, "a real tap focuses the button, and removing it must not read as leaving the field");
    assert.ok(el.querySelector("input"), "the field is there to type into");
  });

  it("opens from anywhere on the collapsed control, not just the magnifier", async () => {
    const el = await mount({ collapsible: true, leading: () => html`<span data-brand>meetup.rio</span>` });

    /** @type {HTMLElement} */ (el.querySelector("[data-brand]")).click();
    await el.$requestUpdate();

    assert.equal(el.expanded, true, "a tap on the pane opens the field, the same as a tap on the icon");
    assert.ok(el.querySelector("input"));
  });

  it("reports the expansion so the host can make room", async () => {
    const el = await mount({ collapsible: true });
    /** @type {boolean[]} */
    const seen = [];
    el.addEventListener("search-expand", (/** @type {any} */ e) => seen.push(e.detail.expanded));

    await el.expand();
    el.collapse();

    assert.deepEqual(seen, [true, false]);
  });

  it("folds the pane away while the field is open, and brings it back", async () => {
    const el = await mount({ collapsible: true, leading: () => "meetup.rio" });
    const aside = el.querySelector(".search-aside");
    const width = () => aside.getBoundingClientRect().width;

    assert.ok(width() > 0, "the wordmark is on screen while collapsed");

    await el.expand();
    await tick(400);
    assert.equal(Math.round(width()), 0, "and yields its room to the field");

    el.collapse();
    await el.$requestUpdate();
    await tick(400);
    assert.ok(width() > 0, "and comes back");
  });

  it("takes Escape twice: the results, then the field itself", async () => {
    const el = await mount({ collapsible: true });
    await el.expand();
    await type(el, "arpo");
    assert.equal(el.open, true, "typing opens the results");

    await press(el, "Escape");
    assert.equal(el.open, false, "the first Escape closes them");
    assert.equal(el.expanded, true, "and leaves the field open");

    await press(el, "Escape");
    assert.equal(el.expanded, false, "the second collapses it");
  });

  it("takes both Escapes even when they land in the same task", async () => {
    const el = await mount({ collapsible: true });
    await el.expand();
    await type(el, "arpo");

    const input = el.querySelector("input");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.$requestUpdate();

    assert.equal(el.expanded, false, "the overlay stack holds Escape while the results are up, so the policy lives in one place");
  });

  it("clears before it collapses", async () => {
    const el = await mount({ collapsible: true });
    await el.expand();
    await type(el, "arpo");

    el.querySelector(".search-clear").click();
    await el.$requestUpdate();
    assert.equal(el.query, "", "the first press empties the field");
    assert.equal(el.expanded, true, "and leaves it open");

    el.querySelector(".search-clear").click();
    await el.$requestUpdate();
    assert.equal(el.expanded, false, "the second closes it");
  });

  it("closes itself once a result takes the reader somewhere", async () => {
    const el = await mount({ collapsible: true, suggestions: RECENT });
    await el.expand();
    await type(el, "arpo");

    el.querySelector(".search-result").click();
    await el.$requestUpdate();
    assert.equal(el.expanded, false, "a result with an href is a departure, so the field closes behind it");
    assert.equal(el.query, "", "and the next tap on the icon starts clean");

    await el.expand();
    await el.$requestUpdate();
    const suggestion = el.querySelector(".search-result");
    assert.equal(suggestion.tagName, "BUTTON", "an empty field offers the suggestions, which carry no href");

    suggestion.click();
    await el.$requestUpdate();
    assert.equal(el.expanded, true, "a suggestion is not a departure, so the field stays open to keep typing");
  });

  it("shows what was searched before anything is typed", async () => {
    const el = await mount({ collapsible: true, suggestions: RECENT });
    await el.expand();

    assert.match(el.querySelector(".search-group-label").textContent, /Recent/);
    assert.equal(el.querySelectorAll(".search-result").length, 1);

    await type(el, "lapa");
    assert.deepEqual(
      [...el.querySelectorAll(".search-result-title")].map((/** @type {Element} */ n) => n.textContent),
      ["Arcos da Lapa", "Baile na Lapa"],
      "and the matches replace them once there is a query",
    );
  });

  it("lets the host draw the row without giving up the anchor", async () => {
    const el = await mount({ renderResult: (/** @type {any} */ doc) => `[${doc.title}]` });
    el.query = "arpo";
    el.open = true;
    await el.$requestUpdate();

    const row = el.querySelector(".search-result");
    assert.equal(row.tagName, "A", "a doc with an href is still a real link");
    assert.equal(row.getAttribute("href"), "/places/arpoador", "carrying the app's base path, as lc-link does");
    assert.equal(row.textContent.trim(), "[Arpoador]", "and the host owns what is inside it");
  });

  it("says so in the reader's language when nothing matches", async () => {
    const el = await mount();
    await type(el, "zzzz");

    assert.equal(el.querySelector(".search-empty").textContent.trim(), "No results");
  });

  it("lets the results be wider than the field they hang from", async () => {
    const el = await mount({});
    el.style.cssText = "width:200px;--lc-search-dropdown-min-width:360px";
    await type(el, "arpo");

    const panel = el.querySelector(".search-dropdown").getBoundingClientRect();
    assert.ok(panel.width >= 360, `a narrow field can still show a readable row: ${Math.round(panel.width)}px`);
    assert.equal(Math.round(panel.left), Math.round(el.getBoundingClientRect().left),
      "and it still hangs from the field's leading edge");
  });

  it("moves the magnifier to the other end on request", async () => {
    const el = await mount({ iconPosition: "right" });
    const box = el.getBoundingClientRect();
    const icon = el.querySelector(".search-icon").getBoundingClientRect();

    assert.ok(icon.left > box.left + box.width / 2, "the icon sits in the right half");
  });
});
