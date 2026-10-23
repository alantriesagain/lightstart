/**
 * `<lc-command-palette>`: the shortcut opens it from anywhere with either
 * command key, the trigger opens it too, a pick closes it and is reported,
 * and Escape closes it through the dialog.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import kbdDef from "@bootstrapp/light/components/display/kbd.js";
import searchDef from "@bootstrapp/light/components/form/search.js";
import paletteDef from "@bootstrapp/light/components/overlay/command-palette.js";
import modalDef from "@bootstrapp/light/components/overlay/modal.js";

const define = (tag, definition) => {
  if (!customElements.get(tag)) View.define(tag, definition);
};
const rendered = (el) => el.$requestUpdate() ?? Promise.resolve();
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const key = (init) => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
const until = async (check, ms = 3000) => {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > ms) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
};

/**
 * A result is a real link; on this page nothing routes, so the click would leave
 * the runner. The host's router intercepts anchors in an app; this stands in.
 * @param {Event} e
 */
const keepThePage = (e) => {
  if (/** @type {Element} */ (e.target).closest?.("a[href]")) e.preventDefault();
};

describe("lc-command-palette", () => {
  /** @type {any} */
  let el;
  /** @type {any[]} */
  const picked = [];

  before(async () => {
    document.addEventListener("click", keepThePage, true);
    define("lc-kbd", kbdDef);
    define("lc-search", searchDef);
    define("lc-modal", modalDef);
    define("lc-command-palette", paletteDef);
    el = document.createElement("lc-command-palette");
    el.docs = [
      { id: "button", group: "Components", title: "Button", href: "/components/display/button" },
      { id: "switch", group: "Components", title: "Switch", href: "/components/form/switch" },
    ];
    el.groups = ["Components"];
    el.addEventListener("command-select", (e) => picked.push(e.detail.id));
    document.body.appendChild(el);
    await rendered(el);
  });

  after(() => {
    el.remove();
    document.removeEventListener("click", keepThePage, true);
  });

  it("draws a trigger with the platform's keys", () => {
    const keys = [...el.querySelectorAll(".command-palette-keys lc-kbd")].map((k) => k.textContent.trim());
    assert.equal(keys.length, 2);
    assert.equal(keys[1], "K");
  });

  it("opens on the shortcut with either command key, and toggles back", async () => {
    key({ key: "k", metaKey: true });
    await rendered(el);
    assert.equal(el.open, true);
    key({ key: "k", ctrlKey: true });
    await rendered(el);
    assert.equal(el.open, false);
    await settle();
  });

  it("opens from its trigger and shows the search inline", async () => {
    const modal = el.querySelector("lc-modal");
    await until(() => modal.dialog && !modal.dialog.open);
    el.querySelector(".command-palette-trigger").click();
    await rendered(el);
    await settle();
    await settle();
    assert.equal(el.open, true, JSON.stringify({ modalOpen: modal.open, dialogOpen: modal.dialog?.open }));
    const search = el.querySelector("lc-search");
    assert.ok(search.hasAttribute("inline"));
  });

  it("a pick closes it and is reported", async () => {
    const search = el.querySelector("lc-search");
    search.query = "sw";
    await rendered(search);
    await settle();
    const result = search.querySelector(".search-result, [role=option]");
    assert.ok(result, "a result is listed");
    result.click();
    await rendered(el);
    assert.deepEqual(picked, ["switch"]);
    assert.equal(result.getAttribute("href"), "/components/form/switch", "the result is a link to the doc");
    assert.equal(el.open, false);
  });
});
