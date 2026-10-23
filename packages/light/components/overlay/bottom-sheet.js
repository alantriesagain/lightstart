import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withOverlay } from "@bootstrapp/light/components/mixins/overlay.js";
import { withPointerDrag } from "../mixins/pointer-drag.js";
import { DISMISS_ZONE_PX, classify, resolveStops } from "./detents.js";
import T from "@bootstrapp/light/types";
import { env } from "@bootstrapp/light/env";

/** @import { DetentName, DragEnd, DragMove, Prop, SheetGeometry } from "../types.ts" */

const DETENTS = ["closed", "half", "full"];
const SUPPRESS_CLICK_MS = 350;
const LIFT_PX = 40;
const EXPANDED_TOP = "calc(max(env(safe-area-inset-top, 0px), var(--sat, 0px)) + var(--lc-bottom-sheet-expanded-gap, 0.75rem))";

export default defineComponent({
  mixins: [
    withOverlay({ lockScroll: true }),
    withPointerDrag({ handle: "[part~=lc-bottom-sheet-nav]", capture: false, touchFallback: true }),
  ],
  tag: "lc-bottom-sheet",
  style: true,
  props: {
    open: false,
    detent: "",
    grabber: false,
    expandable: false,
    expanded: false,
    _room: T.number({ reactive: false, defaultValue: 0 }),
    _classified: T.string({ reactive: false, defaultValue: "" }),
    _suppressClick: T.boolean({ reactive: false, defaultValue: false }),
    _sheet: /** @type {Prop<SheetGeometry | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _clickTimer: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },

  onEscape() {
    if (this.detent) {
      if (this.detent !== "closed") this.setDetent("closed");
      return;
    }
    if (this.open) this.close();
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  willUpdate({ changedProps }) {
    if (changedProps.has("open") && !this.open && this.expanded) this._expand(0);
    if (changedProps.has("detent") && this.detent) {
      this.open = this.detent !== "closed";
      if (this.detent !== this._classified) this._clearFree();
      this._classified = this.detent;
    }
  },

  _clearFree() {
    this.style.removeProperty("--lc-bottom-sheet-drag-y");
    this.style.removeProperty("--lc-bottom-sheet-panel-transition");
  },

  /** @param {string} detent */
  _classify(detent) {
    if (!DETENTS.includes(detent)) return;
    const wasClosed = this.detent === "closed";
    this._classified = detent;
    if (detent !== this.detent) {
      this.detent = detent;
      this.open = detent !== "closed";
      this.$emit("detent-changed", { detent });
      if (wasClosed && detent !== "closed") this.$emit("sheet-opened");
      if (!wasClosed && detent === "closed") this.$emit("sheet-closed");
    }
  },

  /** @param {number} room */
  _expand(room) {
    this._room = room;
    this.expanded = room > 0;
    if (room > 0) this.style.setProperty("--lc-bottom-sheet-lift", `${room}px`);
    else this.style.removeProperty("--lc-bottom-sheet-lift");
  },

  /** @param {HTMLElement} panelEl */
  _roomAbove(panelEl) {
    if (this.expanded) return this._room;
    const probe = document.createElement("div");
    probe.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:${EXPANDED_TOP}`;
    this.append(probe);
    const top = probe.getBoundingClientRect().height;
    probe.remove();
    return Math.max(0, Math.round(panelEl.getBoundingClientRect().top - top));
  },

  _halfPx() {
    const raw = getComputedStyle(this).getPropertyValue("--lc-bottom-sheet-half-height").trim() || "50dvh";
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n)) return env.height / 2;
    if (raw.endsWith("px")) return n;
    if (/(dvh|vh|svh|lvh|%)$/.test(raw)) return (n / 100) * env.height;
    return n;
  },

  connected() {
    const onClick = /** @type {EventListener} */ ((e) => {
      if (!this._suppressClick) return;
      e.stopPropagation();
      e.preventDefault();
    });
    this.addEventListener("click", onClick, { capture: true });
    this.$own(() => {
      this.removeEventListener("click", onClick, { capture: true });
      if (this._clickTimer) clearTimeout(this._clickTimer);
      this._clickTimer = null;
    });
  },

  _holdClick() {
    this._suppressClick = true;
    if (this._clickTimer) clearTimeout(this._clickTimer);
    this._clickTimer = setTimeout(() => {
      this._clickTimer = null;
      this._suppressClick = false;
    }, SUPPRESS_CLICK_MS);
  },

  onDragStart() {
    const navEl = this.querySelector("[part~=lc-bottom-sheet-nav]");
    const panelEl = /** @type {HTMLElement | null} */ (this.querySelector("[part~=lc-bottom-sheet-panel]"));
    if (!navEl || !panelEl) return;

    const stops = resolveStops({
      height: panelEl.offsetHeight,
      halfPx: this._halfPx(),
      peekPx: navEl.getBoundingClientRect().height,
    });
    const base = this.detent
      ? stops[/** @type {DetentName} */ (this.detent)] ?? stops.closed
      : this.open ? stops.full : stops.closed;
    const lifts = !this.detent && this.expandable && this.open;

    this.style.setProperty("--lc-bottom-sheet-panel-transition", "none");
    this._sheet = {
      stops,
      base,
      backdrop: /** @type {HTMLElement | null} */ (this.querySelector("[part~=lc-bottom-sheet-backdrop]")),
      moved: false,
      room: lifts ? this._roomAbove(panelEl) : 0,
      lift: lifts && this.expanded ? this._room : 0,
    };
  },

  /**
   * @param {SheetGeometry} sheet
   * @param {number} dy
   */
  _below(sheet, dy) {
    return sheet.room ? dy - sheet.lift : dy;
  },

  /** @param {DragMove} move */
  onDragMove({ dy }) {
    const sheet = this._sheet;
    if (!sheet) return;
    if (Math.abs(dy) > 4) sheet.moved = true;
    const below = this._below(sheet, dy);
    if (sheet.room) this.style.setProperty("--lc-bottom-sheet-lift", `${Math.min(Math.max(-below, 0), sheet.room)}px`);
    const y = this._clampToStops(sheet, sheet.room ? Math.max(below, 0) : dy);
    this.style.setProperty("--lc-bottom-sheet-drag-y", `${y}px`);
    if (!sheet.backdrop) return;
    const progress = 1 - y / sheet.stops.closed;
    sheet.backdrop.style.opacity = String(Math.max(0, Math.min(progress, 1)));
    sheet.backdrop.style.pointerEvents = progress > 0.1 ? "auto" : "none";
  },

  /** @param {DragEnd} end */
  onDragEnd({ dy }) {
    const sheet = this._sheet;
    this._sheet = null;
    if (!sheet) return;

    if (sheet.backdrop) {
      sheet.backdrop.style.opacity = "";
      sheet.backdrop.style.pointerEvents = "";
    }
    this.style.removeProperty("--lc-bottom-sheet-panel-transition");
    if (!sheet.moved) {
      this.style.removeProperty("--lc-bottom-sheet-drag-y");
      if (sheet.room) this._expand(sheet.lift);
      return;
    }

    const below = this._below(sheet, dy);
    const y = this._clampToStops(sheet, sheet.room ? Math.max(below, 0) : dy);
    if (!this.detent) {
      this.style.removeProperty("--lc-bottom-sheet-drag-y");
      if (sheet.room) this._expand(-below > (sheet.lift ? sheet.room - LIFT_PX : LIFT_PX) ? sheet.room : 0);
      this.open = y < sheet.stops.closed / 2;
      this.$emit(this.open ? "sheet-opened" : "sheet-closed");
    } else if (y >= sheet.stops.closed - DISMISS_ZONE_PX) {
      this.style.removeProperty("--lc-bottom-sheet-drag-y");
      this._classify("closed");
    } else {
      this.style.setProperty("--lc-bottom-sheet-drag-y", `${y}px`);
      const nearest = classify(sheet.stops, y);
      this._classify(nearest === "closed" ? "half" : nearest);
    }

    this._holdClick();
  },

  /**
   * @param {SheetGeometry} sheet
   * @param {number} dy
   */
  _clampToStops(sheet, dy) {
    return Math.max(sheet.stops.full, Math.min(sheet.base + dy, sheet.stops.closed));
  },

  /** @param {string} detent */
  setDetent(detent) {
    if (!DETENTS.includes(detent)) return;
    this._clearFree();
    const wasClosed = this.detent ? this.detent === "closed" : !this.open;
    this._classified = detent;
    if (detent === this.detent) return;
    this.detent = detent;
    this.open = detent !== "closed";
    this.$emit("detent-changed", { detent });
    if (wasClosed && detent !== "closed") this.$emit("sheet-opened");
    if (!wasClosed && detent === "closed") this.$emit("sheet-closed");
  },

  resetScroll() {
    const content = this.querySelector("[part~=lc-bottom-sheet-content]");
    if (content) content.scrollTop = 0;
  },

  toggle() {
    if (this.detent) return this.setDetent(this.detent === "closed" ? "full" : "closed");
    this.open ? this.close() : this.openSheet();
  },

  openSheet() {
    if (this.detent) return this.setDetent("full");
    this.open = true;
    this.$emit("sheet-opened");
  },

  close() {
    if (this.detent) return this.setDetent("closed");
    this.open = false;
    this.$emit("sheet-closed");
  },

  render() {
    return html`
      <div part="lc-bottom-sheet-backdrop" @click=${() => this.close()}></div>
      <div part="lc-bottom-sheet-panel">
        <div part="lc-bottom-sheet-nav">
          ${this.grabber ? html`<div part="lc-bottom-sheet-grabber"></div>` : ""}
          <slot name="nav"></slot>
        </div>
        <div part="lc-bottom-sheet-content">
          <slot name="sheet"></slot>
        </div>
      </div>
    `;
  },
});

/**
 * Bottom Sheet Component
 *
 * @component
 * @category overlay
 * @tag lc-bottom-sheet
 *
 * A panel at the bottom edge. By default it peeks: `nav` stays visible with the
 * rest tucked below, and dragging it or setting `open` reveals the content.
 * The `nav` band is the drag handle and nothing else is, so a handle drawn
 * inside the content is only a picture of one: set `grabber` and the sheet
 * draws the bar in its `nav` part, which also gives a modal sheet a handle.
 *
 * **It is also the modal sheet.** `--lc-bottom-sheet-nav-height: 0` leaves
 * nothing peeking, so the panel is off-screen until `open`: which with the
 * backdrop it already draws is exactly a sheet that rises when asked for. Set
 * `--lc-bottom-sheet-sheet-height: auto` and it takes the height of its
 * content instead of a fixed fraction of the viewport, up to the screen below
 * the status bar and `--lc-bottom-sheet-top-gap` (0.75rem), past which it
 * scrolls inside (`--lc-bottom-sheet-max-height` sets another cap). Reach for
 * the modal sheet before hand-rolling a `fixed inset-0` scrim, and before
 * `lc-modal`, which is a centred `<dialog>`. A layer that has to rise over an
 * open sheet without closing it is `lc-modal variant="sheet"`: a dialog in the
 * top layer, sized to its content at the bottom edge on a phone.
 *
 * **Expandable**: set `expandable` on a sheet without `detent` and a drag up on
 * the handle lifts it toward `--lc-bottom-sheet-expanded-gap` (0.75rem) below
 * the status bar; let go past 40px and it stays `expanded`, until a drag back
 * down or the next close. So a larger `--lc-bottom-sheet-top-gap` is where it
 * opens and the expanded gap is how far it goes. `--lc-bottom-sheet-lift` on
 * the host is how much taller than at rest it is, and slotted content inherits
 * it: a list that reads it grows with the sheet, where content past the cap
 * would only scroll.
 *
 * **Detent mode**: set `detent` (`closed` | `half` | `full`) and the nav
 * band becomes a resize handle: a drag follows the finger and STAYS where it
 * is released (only a drop near the bottom dismisses); `setDetent()` snaps
 * programmatically (taps, navigation); `detent-changed` reports the nearest
 * stop after every gesture, and `open` stays synced (`closed` ⇒ not open).
 * The half stop's height comes from `--lc-bottom-sheet-half-height`
 * (default 50dvh). An empty `detent` (the default) is the legacy two-state
 * behavior.
 *
 * @example
 * // Peeking, the default: a mini player that expands
 * ```html
 * <lc-bottom-sheet nobackdrop ?open=${this.expanded}>
 *   <header slot="nav">Now playing</header>
 *   <div slot="sheet">…</div>
 * </lc-bottom-sheet>
 * ```
 *
 * @example
 * // Modal: absent until asked for, sized to its content
 * ```html
 * <lc-bottom-sheet
 *   style="--lc-bottom-sheet-nav-height:0px;--lc-bottom-sheet-sheet-height:auto"
 *   ?open=${this.showSwap}
 *   @sheet-closed=${() => (this.showSwap = false)}
 * >
 *   <div slot="sheet">…</div>
 * </lc-bottom-sheet>
 * ```
 *
 * @example
 * // Modal with a handle, opening below a band of the page, dragged up to grow
 * ```html
 * <lc-bottom-sheet grabber expandable
 *   style="--lc-bottom-sheet-nav-height:0px;--lc-bottom-sheet-sheet-height:auto;--lc-bottom-sheet-top-gap:10dvh"
 *   ?open=${this.open}>
 *   <div slot="sheet">
 *     <ul style="max-height:calc(12rem + var(--lc-bottom-sheet-lift, 0px));overflow-y:auto">…</ul>
 *   </div>
 * </lc-bottom-sheet>
 * ```
 *
 * @example
 * // Three-stop map sheet, starts half-open
 * ```html
 * <lc-bottom-sheet nobackdrop detent="half" @detent-changed=${(e) => this.onDetent(e.detail.detent)}>
 *   <header slot="nav">3 meetups · 30 events</header>
 *   <div slot="sheet">…</div>
 * </lc-bottom-sheet>
 * ```
 */
