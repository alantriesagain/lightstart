/**
 * `setPointerCapture` throws for a pointerId no device owns, so the host stubs
 * the three capture methods (the same narrowing as `mixins/pointer-drag`).
 * These cases prove the deck's contract: a throw past the threshold commits,
 * a short or vertical drag does not, a tap selects, the buttons and the
 * keyboard do what the gesture does, the deck ends and can undo. The throw
 * duration is set to zero so a commit lands synchronously.
 */
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";
import { html } from "@bootstrapp/light/html";

const { default: deckDef } = await import("./swipe-deck.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

/** @type {Element[]} */
const mounted = [];

const mount = async (items = [{ id: 1 }, { id: 2 }, { id: 3 }]) => {
  const el = /** @type {any} */ (document.createElement("lc-swipe-deck"));
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  el.hasPointerCapture = () => true;
  el.style.cssText = "width:300px;height:400px;--lc-swipe-deck-throw-duration:0ms";
  el.items = items;
  el.card = (/** @type {{ id: number }} */ item, /** @type {{ depth: number }} */ ctx) => html`<b data-id=${item.id} data-depth=${ctx.depth}>${item.id}</b><button type="button" data-inner>♥</button>`;
  el.empty = () => html`<i data-empty>done</i>`;
  /** @type {string[]} */
  const seen = [];
  for (const name of ["swipe", "select", "index-change", "end", "undo"])
    el.addEventListener(name, (/** @type {CustomEvent} */ e) => seen.push(`${name}:${JSON.stringify(e.detail)}`));
  document.body.append(el);
  mounted.push(el);
  await tick();
  await el.$requestUpdate();
  return { el, seen, top: () => /** @type {HTMLElement} */ (el.querySelector('[part~=lc-swipe-deck-card][data-depth="0"]')) };
};

/** @param {Element} target @param {string} type @param {number} x @param {number} y */
const pointer = (target, type, x, y) =>
  target.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "mouse", button: 0, clientX: x, clientY: y, bubbles: true, composed: true, cancelable: true }));

/** @param {any} el @param {Element} from @param {number} dx @param {number} dy */
const drag = async (el, from, dx, dy) => {
  pointer(from, "pointerdown", 100, 100);
  pointer(el, "pointermove", 100 + dx, 100 + dy);
  await frame();
  pointer(el, "pointerup", 100 + dx, 100 + dy);
  await tick();
  await el.$requestUpdate();
};

describe("@bootstrapp/light - lc-swipe-deck", () => {
  before(() => {
    if (!customElements.get("lc-swipe-deck")) View.define("lc-swipe-deck", deckDef);
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = new URL("./swipe-deck.css", import.meta.url).href;
    document.head.append(sheet);
    return new Promise((resolve) => { sheet.onload = () => resolve(undefined); sheet.onerror = () => resolve(undefined); });
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("renders the top card and two behind it, and counts from one", async () => {
    const { el } = await mount();
    const cards = [...el.querySelectorAll("[part~=lc-swipe-deck-card]")].map((c) => c.getAttribute("data-depth"));
    assert.deepEqual(cards, ["2", "1", "0"], "deepest first so the top card paints last");
    assert.equal(el.querySelector("[part~=lc-swipe-deck-counter]").textContent.trim(), "1 / 3");
  });

  it("the stage takes the height the host gives it, so a card has real size", async () => {
    const { el, top } = await mount();
    const stage = /** @type {HTMLElement} */ (el.querySelector("[part~=lc-swipe-deck-stage]"));
    assert.ok(stage.getBoundingClientRect().height > 200, `the stage fills the deck (${stage.getBoundingClientRect().height})`);
    assert.ok(top().getBoundingClientRect().height > 200, "the top card fills the stage");
  });

  it("a throw past the threshold commits a swipe and advances", async () => {
    const { el, seen, top } = await mount();
    await drag(el, top(), 150, 5);
    assert.deepEqual(seen, ['swipe:{"direction":"right","index":0,"item":{"id":1}}', 'index-change:{"index":1}']);
    assert.equal(el.index, 1);
    assert.equal(top().querySelector("[data-id]").getAttribute("data-id"), "2");
    assert.equal(top().style.transform, "", "the reused node carries no inline transform");
  });

  it("a short drag springs back and commits nothing", async () => {
    const { el, seen, top } = await mount();
    await drag(el, top(), 40, 0);
    assert.deepEqual(seen, []);
    assert.equal(el.index, 0);
    assert.equal(top().style.transform, "");
  });

  it("a mostly vertical drag does not commit even past the threshold", async () => {
    const { el, seen, top } = await mount();
    await drag(el, top(), 100, 160);
    assert.deepEqual(seen, []);
  });

  it("a tap on the card selects it, a tap on a control inside does not", async () => {
    const { el, seen, top } = await mount();
    await drag(el, top(), 0, 0);
    assert.deepEqual(seen, ['select:{"index":0,"item":{"id":1}}']);
    seen.length = 0;
    await drag(el, /** @type {Element} */ (top().querySelector("[data-inner]")), 0, 0);
    assert.deepEqual(seen, [], "the inner button keeps its own click");
  });

  it("the buttons and the keyboard do what the gesture does", async () => {
    const { el, seen } = await mount();
    /** @type {HTMLElement} */ (el.querySelector("[part~=lc-swipe-deck-skip]")).click();
    await el.$requestUpdate();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await el.$requestUpdate();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.deepEqual(seen, [
      'swipe:{"direction":"left","index":0,"item":{"id":1}}', 'index-change:{"index":1}',
      'swipe:{"direction":"right","index":1,"item":{"id":2}}', 'index-change:{"index":2}',
      'select:{"index":2,"item":{"id":3}}',
    ]);
  });

  it("running past the last card ends the deck and renders the empty state, and undo brings one back", async () => {
    const { el, seen } = await mount([{ id: 1 }]);
    el.swipe("right");
    await el.$requestUpdate();
    assert.ok(seen.includes("end:{}"));
    assert.ok(el.querySelector("[data-empty]"), "empty renderer shown");
    el.undo();
    await el.$requestUpdate();
    assert.equal(el.index, 0);
    assert.ok(seen.includes('undo:{"index":0,"item":{"id":1}}'));
    assert.ok(el.querySelector("[part~=lc-swipe-deck-card]"), "the card is back");
  });

  it("removing the deck mid-drag leaves no pending frame or drag", async () => {
    const { el, top } = await mount();
    pointer(top(), "pointerdown", 100, 100);
    pointer(el, "pointermove", 130, 100);
    el.remove();
    await tick();
    assert.equal(el._drag, null);
    assert.equal(el._dragRaf, 0);
  });
});
