import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { html } from "@bootstrapp/light/html";
import View from "@bootstrapp/light";

const { default: commentDef } = await import("./comment.js");

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

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3600e3 - 60e3).toISOString();

/** @type {Element[]} */
const mounted = [];

/** @param {Record<string, unknown>} [props] */
const mount = async (props = {}) => {
  const el = Object.assign(
    document.createElement("lc-comment"),
    { author: "Ana Souza", at: TWO_HOURS_AGO, body: "Love this spot!" },
    props,
  );
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return el;
};

describe("@bootstrapp/light - lc-comment", () => {
  const lang = document.documentElement.lang;

  before(async () => {
    if (!customElements.get("lc-comment")) View.define("lc-comment", commentDef);
    await loadStyles("comment");
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

  it("draws the author's avatar and name, how long ago, and the text", async () => {
    const el = await mount({ avatar: "https://example.com/ana.jpg" });
    const avatar = el.querySelector("lc-avatar");
    assert.equal(avatar.getAttribute("name"), "Ana Souza");
    assert.equal(avatar.getAttribute("src"), "https://example.com/ana.jpg");
    assert.equal(el.querySelector(".comment-author").textContent, "Ana Souza");
    const time = el.querySelector("time");
    assert.equal(time.textContent, "2 hours ago");
    assert.equal(time.getAttribute("datetime"), TWO_HOURS_AGO);
    assert.ok(time.getAttribute("title"), "the full date is the title");
    assert.equal(el.querySelector(".comment-body").textContent, "Love this spot!");
    assert.equal(el.querySelector(".comment-actions"), null, "no actions, no row");
    assert.equal(el.querySelector("lc-badge"), null);
  });

  it("reads the time in the page's language", async () => {
    document.documentElement.lang = "pt-BR";
    const el = await mount();
    assert.equal(el.querySelector("time").textContent, "há 2 horas");
  });

  it("draws no time for a timestamp nobody can read", async () => {
    const el = await mount({ at: "not a date" });
    assert.equal(el.querySelector("time"), null);
  });

  it("links the author through lc-link, and an absolute url opens outside the app", async () => {
    const plain = await mount();
    assert.equal(plain.querySelector("lc-link"), null);
    assert.equal(plain.querySelector("span.comment-author").textContent, "Ana Souza");

    const internal = await mount({ href: "/people/ana" });
    const link = internal.querySelector("lc-link.comment-author");
    assert.equal(link.getAttribute("href"), "/people/ana");
    assert.equal(link.getAttribute("label"), "Ana Souza");
    assert.equal(link.hasAttribute("external"), false);

    const external = await mount({ href: "https://www.instagram.com/ana" });
    assert.equal(external.querySelector("lc-link").hasAttribute("external"), true);
  });

  it("a concealed comment draws muted with a Hidden badge", async () => {
    const shown = await mount();
    const el = await mount({ concealed: true });
    assert.equal(el.hasAttribute("concealed"), true, "the attribute reflects");
    assert.ok(el.getBoundingClientRect().height > 0);
    assert.equal(el.querySelector("lc-badge").textContent, "Hidden");
    assert.ok(Number(getComputedStyle(el.querySelector(".comment-body")).opacity) < 1);
    assert.equal(getComputedStyle(shown.querySelector(".comment-body")).opacity, "1");

    el.concealed = false;
    await el.$requestUpdate();
    assert.equal(el.querySelector("lc-badge"), null);
  });

  it("draws what the actions function returns, and redraws when it changes", async () => {
    let clicked = 0;
    const el = await mount({
      actions: () => html`<button class="reply" @click=${() => clicked++}>Reply</button>`,
    });
    const row = el.querySelector(".comment-actions");
    assert.ok(row.getBoundingClientRect().top >= el.querySelector(".comment-body").getBoundingClientRect().bottom - 1, "the actions sit under the text");
    row.querySelector("button.reply").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.equal(clicked, 1);

    el.actions = () => html`<button class="unhide">Unhide</button>`;
    await el.$requestUpdate();
    assert.equal(el.querySelector(".comment-actions button").className, "unhide");

    el.actions = null;
    await el.$requestUpdate();
    assert.equal(el.querySelector(".comment-actions"), null);
  });

  it("keeps the line breaks a comment was written with", async () => {
    const el = await mount({ body: "first line\nsecond line" });
    const body = el.querySelector(".comment-body");
    assert.equal(getComputedStyle(body).whiteSpace, "pre-wrap");
    assert.equal(body.textContent, "first line\nsecond line");
  });
});
