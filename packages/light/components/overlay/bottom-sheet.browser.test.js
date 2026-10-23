/**
 * The sheet's pointer path takes no pointer capture, so a synthetic pointer
 * drives it end to end. Its raw-touch fallback is the half no synthetic event
 * can reach; that one is verified on a device.
 */
import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: sheetDef } = await import("./bottom-sheet.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

const PANEL_H = 400;
const NAV_H = 60;
const HALF = 200;

/** @type {any[]} */
const mounted = [];

const mount = async (/** @type {{ detent?: string }} */ opts = {}) => {
  const sheet = /** @type {any} */ (document.createElement("lc-bottom-sheet"));
  if (opts.detent) sheet.setAttribute("detent", opts.detent);
  sheet.style.setProperty("--lc-bottom-sheet-half-height", `${HALF}px`);
  document.body.append(sheet);
  mounted.push(sheet);
  await tick();
  await sheet.$requestUpdate();

  const root = sheet;
  const panel = /** @type {HTMLElement} */ (root.querySelector("[part~=lc-bottom-sheet-panel]"));
  const nav = /** @type {HTMLElement} */ (root.querySelector("[part~=lc-bottom-sheet-nav]"));
  panel.style.cssText = `display:block;height:${PANEL_H}px`;
  nav.style.cssText = `display:block;height:${NAV_H}px`;
  return { sheet, root, panel, nav };
};

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {number} y
 */
const point = (target, type, y) =>
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: 1, clientX: 0, clientY: y, button: 0, pointerType: "mouse",
    bubbles: true, composed: true, cancelable: true,
  }));

/** @param {any} sheet */
const dragY = (sheet) => sheet.style.getPropertyValue("--lc-bottom-sheet-drag-y");

const countDocumentMoves = () => {
  const add = document.addEventListener;
  const remove = document.removeEventListener;
  let live = 0;
  document.addEventListener = /** @type {typeof document.addEventListener} */ (function (/** @type {string} */ type, /** @type {any[]} */ ...rest) {
    if (type === "pointermove") live++;
    return add.call(this, type, ...rest);
  });
  document.removeEventListener = /** @type {typeof document.removeEventListener} */ (function (/** @type {string} */ type, /** @type {any[]} */ ...rest) {
    if (type === "pointermove") live--;
    return remove.call(this, type, ...rest);
  });
  return {
    get live() {
      return live;
    },
    restore() {
      document.addEventListener = add;
      document.removeEventListener = remove;
    },
  };
};

describe("@bootstrapp/light - lc-bottom-sheet drag", () => {
  before(() => View.define("lc-bottom-sheet", sheetDef));

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  after(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  it("drags from the nav and nowhere else", async () => {
    const { sheet, root, nav } = await mount({ detent: "full" });

    const content = /** @type {EventTarget} */ (root.querySelector("[part~=lc-bottom-sheet-content]"));
    point(content, "pointerdown", 10);
    await frame();
    assert.equal(sheet._sheet, null, "a press on the content is not a drag");

    point(nav, "pointerdown", 10);
    await frame();
    assert.notEqual(sheet._sheet, null, "a press on the nav is");
    assert.deepEqual(sheet._sheet.stops, { full: 0, half: HALF, closed: PANEL_H - NAV_H });

    point(document, "pointerup", 10);
    await frame();
  });

  it("follows the pointer down from the fully open stop", async () => {
    const { sheet, nav } = await mount({ detent: "full" });

    point(nav, "pointerdown", 0);
    point(document, "pointermove", 100);
    await frame();

    assert.equal(dragY(sheet), "100px");

    point(document, "pointerup", 100);
    await frame();
  });

  it("never travels past its own stops", async () => {
    const { sheet, nav } = await mount({ detent: "full" });

    point(nav, "pointerdown", 0);
    point(document, "pointermove", 5000);
    await frame();
    assert.equal(dragY(sheet), `${PANEL_H - NAV_H}px`, "clamped at closed");

    point(document, "pointermove", -5000);
    await frame();
    assert.equal(dragY(sheet), "0px", "and at full");

    point(document, "pointerup", -5000);
    await frame();
  });

  it("settles on the nearest stop it was released next to", async () => {
    const { sheet, nav } = await mount({ detent: "full" });
    /** @type {string[]} */
    const seen = [];
    sheet.addEventListener("detent-changed", (/** @type {any} */ e) => seen.push(e.detail.detent));

    point(nav, "pointerdown", 0);
    point(document, "pointermove", 180);
    await frame();
    point(document, "pointerup", 180);
    await frame();

    assert.equal(sheet.detent, "half", "180 of a 200 half-stop is half");
    assert.deepEqual(seen, ["half"]);
  });

  it("reads a release inside the dismiss zone as closed", async () => {
    const { sheet, nav } = await mount({ detent: "full" });

    point(nav, "pointerdown", 0);
    point(document, "pointermove", PANEL_H - NAV_H - 5);
    await frame();
    point(document, "pointerup", PANEL_H - NAV_H - 5);
    await frame();

    assert.equal(sheet.detent, "closed");
    assert.equal(dragY(sheet), "", "the stop is the stylesheet's job once it is classified");
  });

  it("leaves a press that never moved exactly where it was", async () => {
    const { sheet, nav } = await mount({ detent: "half" });

    point(nav, "pointerdown", 40);
    point(document, "pointermove", 42);
    await frame();
    point(document, "pointerup", 42);
    await frame();

    assert.equal(sheet.detent, "half", "two pixels is a tap, not a drag");
    assert.equal(sheet._suppressClick, false, "so the click it carries is not swallowed");
  });

  it("drops its document listeners on release", async () => {
    const { sheet, nav } = await mount({ detent: "full" });

    point(nav, "pointerdown", 0);
    point(document, "pointermove", 100);
    await frame();
    point(document, "pointerup", 100);
    await frame();

    const settled = dragY(sheet);
    assert.equal(settled, "100px", "it settled where it was released");
    point(document, "pointermove", 300);
    await frame();
    assert.equal(dragY(sheet), settled, "a later pointermove reaches nothing");
  });

  it("takes its document listeners with it when it goes away mid-drag", async () => {
    const { sheet, nav } = await mount({ detent: "full" });
    const moves = countDocumentMoves();

    try {
      point(nav, "pointerdown", 0);
      point(document, "pointermove", 60);
      await frame();
      assert.equal(moves.live, 1, "the drag is listening on the document");
      assert.equal(dragY(sheet), "60px", "and it had moved the sheet");

      sheet.remove();
      await tick();
      assert.equal(moves.live, 0, "teardown unregistered it, so a remount cannot stack a second");
      assert.equal(sheet._drag, null);
    } finally {
      moves.restore();
    }
  });

  it("unregisters as many document listeners as it registers, drag after drag", async () => {
    const { nav } = await mount({ detent: "full" });
    const moves = countDocumentMoves();

    try {
      for (const y of [40, 90, 140]) {
        point(nav, "pointerdown", 0);
        point(document, "pointermove", y);
        await frame();
        point(document, "pointerup", y);
        await frame();
      }
      assert.equal(moves.live, 0, "three drags left nothing behind");
    } finally {
      moves.restore();
    }
  });

  it("opens and closes on a release past halfway when it has no detents", async () => {
    const { sheet, nav } = await mount();
    /** @type {string[]} */
    const seen = [];
    sheet.addEventListener("sheet-opened", () => seen.push("opened"));
    sheet.addEventListener("sheet-closed", () => seen.push("closed"));

    point(nav, "pointerdown", 0);
    point(document, "pointermove", -300);
    await frame();
    point(document, "pointerup", -300);
    await frame();

    assert.equal(sheet.open, true);
    assert.deepEqual(seen, ["opened"]);
  });
});

/**
 * A modal sheet as an app mounts one: nothing peeking, sized to its content.
 * @param {string[]} attrs
 * @param {string} style
 * @param {string} contentHeight
 */
const mountModal = async (attrs, style, contentHeight) => {
  const sheet = /** @type {HTMLElement & { open: boolean, expanded: boolean, $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-bottom-sheet"));
  for (const name of attrs) sheet.setAttribute(name, "");
  sheet.style.cssText = `--lc-bottom-sheet-nav-height:0px;--lc-bottom-sheet-sheet-height:auto;${style}`;
  sheet.innerHTML = `<div slot="sheet" style="height:${contentHeight}"></div>`;
  document.body.append(sheet);
  mounted.push(sheet);
  await tick();
  sheet.open = true;
  await sheet.$requestUpdate();
  const root = sheet;
  return { sheet, root, grabber: /** @type {HTMLElement} */ (root.querySelector("[part~=lc-bottom-sheet-grabber]")) };
};

describe("@bootstrapp/light - lc-bottom-sheet grabber and lift", () => {
  /** @type {HTMLLinkElement | null} */
  let css = null;

  before(() => {
    if (!customElements.get("lc-bottom-sheet")) View.define("lc-bottom-sheet", sheetDef);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./bottom-sheet.css", import.meta.url).href;
    document.head.append(link);
    css = link;
    return new Promise((resolve) => { link.onload = () => resolve(undefined); link.onerror = () => resolve(undefined); });
  });

  afterEach(async () => {
    for (const el of mounted.splice(0)) el.remove();
    await tick();
  });

  after(() => css?.remove());

  it("draws its grabber inside the nav, so a modal sheet has a handle a mouse can drag", async () => {
    const { sheet, root, grabber } = await mountModal(["grabber"], "", "300px");
    assert.ok(grabber?.matches("[part~=lc-bottom-sheet-nav] > [part~=lc-bottom-sheet-grabber]"), "the bar is in the nav, which is the handle");
    assert.ok(/** @type {HTMLElement} */ (root.querySelector("[part~=lc-bottom-sheet-nav]")).getBoundingClientRect().height > 0,
      "so a sheet whose nav is 0px tall still has something to hold");

    point(grabber, "pointerdown", 100);
    point(document, "pointermove", 160);
    await frame();
    assert.equal(dragY(sheet), "60px", "and the panel follows the pointer down");
    point(document, "pointerup", 160);
    await frame();
    assert.equal(sheet.open, true, "60px is not halfway, so it stays open");
  });

  it("an expandable sheet lifts toward the top on a drag up, stays there past 40px, and comes back down", async () => {
    const { sheet, grabber } = await mountModal(["grabber", "expandable"], "--lc-bottom-sheet-top-gap:40vh", "200vh");
    const lift = () => sheet.style.getPropertyValue("--lc-bottom-sheet-lift");

    point(grabber, "pointerdown", 400);
    point(document, "pointermove", 370);
    await frame();
    assert.equal(lift(), "30px", "the lift follows the pointer up");
    assert.equal(dragY(sheet), "0px", "and the panel does not slide while it rises");
    point(document, "pointerup", 370);
    await frame();
    assert.equal(sheet.expanded, false, "30px lets it settle back");
    assert.equal(lift(), "");

    point(grabber, "pointerdown", 400);
    point(document, "pointermove", 100);
    await frame();
    point(document, "pointerup", 100);
    await frame();
    assert.equal(sheet.expanded, true, "past 40px it stays up");
    const room = Number.parseFloat(lift());
    assert.ok(room > 0 && room < 300, `as far as the room above allows: ${lift()}`);

    point(grabber, "pointerdown", 100);
    point(document, "pointermove", 160);
    await frame();
    assert.equal(Number.parseFloat(lift()), room - 60, "a drag down takes back the lift first");
    point(document, "pointerup", 160);
    await frame();
    assert.equal(sheet.expanded, false, "and 60px back is enough to return to rest");
    assert.equal(sheet.open, true, "without closing");

    point(grabber, "pointerdown", 400);
    point(document, "pointermove", 100);
    await frame();
    point(document, "pointerup", 100);
    await frame();
    assert.equal(sheet.expanded, true);
    sheet.open = false;
    await sheet.$requestUpdate();
    await tick();
    assert.equal(sheet.expanded, false, "closing lets go of the lift, so the next open starts at rest");
    assert.equal(lift(), "");
  });

  it("a closed sheet with no nav shows nothing over the device's bottom inset, and a nav still clears it", async () => {
    const visibleWhenClosed = async (/** @type {string} */ style) => {
      const sheet = /** @type {HTMLElement & { $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-bottom-sheet"));
      sheet.setAttribute("grabber", "");
      sheet.style.cssText = `--lc-bottom-sheet-panel-transition:none;--sab:34px;${style}`;
      sheet.innerHTML = `<div slot="sheet" style="height:200px"></div>`;
      document.body.append(sheet);
      mounted.push(sheet);
      await tick();
      await sheet.$requestUpdate();
      await frame();
      const panel = /** @type {HTMLElement} */ (sheet.querySelector("[part~=lc-bottom-sheet-panel]"));
      return Math.round(innerHeight - panel.getBoundingClientRect().top);
    };
    assert.equal(await visibleWhenClosed("--lc-bottom-sheet-nav-height:0px;--lc-bottom-sheet-sheet-height:auto"), 0);
    assert.equal(await visibleWhenClosed("--lc-bottom-sheet-nav-height:56px"), 90, "the 56px nav above a 34px inset");
  });

  it("a sheet that is not expandable never lifts", async () => {
    const { sheet, grabber } = await mountModal(["grabber"], "--lc-bottom-sheet-top-gap:40vh", "200vh");

    point(grabber, "pointerdown", 400);
    point(document, "pointermove", 100);
    await frame();
    point(document, "pointerup", 100);
    await frame();
    assert.equal(sheet.style.getPropertyValue("--lc-bottom-sheet-lift"), "");
    assert.equal(sheet.expanded, false);
  });
});
