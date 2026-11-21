/**
 * `<lc-command-palette>`: the shortcut opens it from anywhere with either
 * command key, the trigger opens it too, a pick closes it and is reported,
 * and Escape closes it through the dialog.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import View from "@lightstart/light";
import kbdDef from "@lightstart/components/display/kbd.js";
import searchDef from "@lightstart/components/form/search.js";
import paletteDef from "@lightstart/components/overlay/command-palette.js";
import modalDef from "@lightstart/components/overlay/modal.js";

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

describe("lc-command-palette anchored", () => {
  /** @type {HTMLElement & { open: boolean, hideTrigger: boolean, anchor: string, docs: Array<Record<string, string>>, groups: string[], $requestUpdate: () => Promise<unknown> }} */
  let palette;
  /** @type {HTMLInputElement} */
  let anchor;
  /** @type {string[]} */
  const picked = [];

  const panel = () => /** @type {HTMLElement | null} */ (palette.querySelector("[part~=lc-command-palette-panel]"));

  before(async () => {
    document.addEventListener("click", keepThePage, true);
    define("lc-kbd", kbdDef);
    define("lc-search", searchDef);
    define("lc-modal", modalDef);
    define("lc-command-palette", paletteDef);
    anchor = document.createElement("input");
    anchor.id = "palette-anchor-field";
    anchor.style.cssText = "display:block; width: 320px; margin: 60px 20px;";
    palette = document.createElement("lc-command-palette");
    palette.hideTrigger = true;
    palette.setAttribute("anchor", anchor.id);
    palette.docs = [
      { id: "button", group: "Components", title: "Button", href: "/components/display/button" },
      { id: "switch", group: "Components", title: "Switch", href: "/components/form/switch" },
    ];
    palette.groups = ["Components"];
    palette.addEventListener("command-select", (e) => picked.push(e.detail.id));
    document.body.append(anchor, palette);
    await rendered(palette);
  });

  after(async () => {
    palette.remove();
    anchor.remove();
    document.removeEventListener("click", keepThePage, true);
  });

  const open = async () => {
    palette.open = true;
    await rendered(palette);
    await settle();
    await until(() => {
      const el = panel();
      return Boolean(el && !el.hidden && el.getBoundingClientRect().height > 0);
    });
  };

  const close = async () => {
    palette.open = false;
    await rendered(palette);
    await settle();
  };

  it("opens below the anchor, at least as wide as it", async () => {
    await open();
    const box = /** @type {HTMLElement} */ (panel()).getBoundingClientRect();
    const field = anchor.getBoundingClientRect();
    assert.ok(box.top >= field.bottom, JSON.stringify({ top: box.top, bottom: field.bottom }));
    assert.ok(box.width >= field.width - 1, JSON.stringify({ width: box.width, field: field.width }));
    assert.equal(palette.querySelector("dialog"), null, "there is no modal in anchored mode");
    await close();
  });

  it("closes on Escape and hands focus back to the anchor", async () => {
    await open();
    key({ key: "Escape" });
    await rendered(palette);
    await settle();
    assert.equal(palette.open, false);
    assert.equal(document.activeElement, anchor);
  });

  it("closes on a pointer down outside the panel and the anchor", async () => {
    await open();
    await new Promise((resolve) => setTimeout(resolve, 10));
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
    await rendered(palette);
    await settle();
    assert.equal(palette.open, false);
  });

  it("reports a pick the way the modal does", async () => {
    picked.length = 0;
    await open();
    const search = palette.querySelector("lc-search");
    search.query = "sw";
    await rendered(search);
    await settle();
    const result = search.querySelector(".search-result, [role=option]");
    assert.ok(result, "a result is listed");
    result.click();
    await rendered(palette);
    assert.deepEqual(picked, ["switch"]);
    assert.equal(palette.open, false);
  });
});
