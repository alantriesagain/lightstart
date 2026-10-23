import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { withOverlay } from "@bootstrapp/light/components/mixins/overlay.js";
import { withSwipeThreshold } from "../mixins/swipe-threshold.js";
import { nextIndex } from "../utils/roving.js";
import { lcText } from "../utils/text.js";

/** @import { Prop, StoryBackground, StoryRenderer } from "../types.ts" */

export default defineComponent({
  mixins: [
    withOverlay({ lockScroll: true }),
    withSwipeThreshold({ axisProp: "axis", ratio: 1.2, enabled: "open" }),
  ],
  tag: "lc-stories",
  class: "block",
  style: true,
  props: {
    items: /** @type {Prop<unknown[]>} */ (T.array({ defaultValue: [], attribute: false })),
    index: 0,
    open: false,
    full: false,
    axis: T.string({ defaultValue: "y", enum: ["x", "y"] }),
    tapZones: false,
    duration: 0,
    media: /** @type {Prop<StoryRenderer | null>} */ (T.function()),
    header: /** @type {Prop<StoryRenderer | null>} */ (T.function()),
    footer: /** @type {Prop<StoryRenderer | null>} */ (T.function()),
    background: /** @type {Prop<StoryBackground | null>} */ (T.function()),
    _lastWheel: T.number({ reactive: false, defaultValue: 0 }),
  },
  connected() {
    const onKeydown = (/** @type {KeyboardEvent} */ e) => {
      if (!this.open) return;
      const next = nextIndex(e.key, this.index, this.items.length, { orientation: "both" });
      if (next !== null) this._to(next);
    };
    globalThis.addEventListener("keydown", onKeydown);
    this.$own(() => globalThis.removeEventListener("keydown", onKeydown));
  },
  onEscape() {
    this.close();
  },
  /** @param {unknown[]} items */
  show(items, index = 0) {
    this.items = items;
    this.index = Math.max(0, Math.min(index, items.length - 1));
    this.open = true;
  },
  close() {
    this.open = false;
    this.$emit("close");
  },
  /** @param {number} index */
  _to(index) {
    this.index = index;
    this.$emit("index-change", { index });
  },
  /** @param {number} delta */
  _go(delta) {
    const next = this.index + delta;
    if (next < 0 || next >= this.items.length) return;
    this._to(next);
  },
  /** @param {number} direction */
  onSwipe(direction) {
    this._go(direction < 0 ? 1 : -1);
  },
  /**
   * A tap on the story itself: the left third goes back, the rest forward. A
   * control inside the media keeps its tap.
   * @param {MouseEvent} e
   */
  _onTap(e) {
    if (!this.tapZones) return;
    const target = /** @type {HTMLElement | null} */ (e.target instanceof HTMLElement ? e.target : null);
    if (target?.closest("button, a, input, textarea, select, [data-no-tap]")) return;
    const zone = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
    this._go(e.clientX - zone.left < zone.width * 0.3 ? -1 : 1);
  },
  _onSegmentEnd() {
    if (this.index < this.items.length - 1) this._go(1);
  },
  /** @param {WheelEvent} e */
  _onWheel(e) {
    e.preventDefault();
    const now = performance.now();
    if (now - this._lastWheel < 400 || Math.abs(e.deltaY) < 25) return;
    this._lastWheel = now;
    this._go(e.deltaY > 0 ? 1 : -1);
  },
  render() {
    if (!this.open) return html``;
    const items = this.items;
    const item = items[this.index];
    const ctx = { close: () => this.close(), go: (/** @type {number} */ d) => this._go(d), index: this.index, total: items.length };
    if (!item)
      return html`
        <div class="fixed inset-0 flex items-center justify-center bg-black" style="z-index:var(--lc-stories-z, 1200)" @click=${() => this.close()}>
          <p class="text-sm font-bold text-white/70">${lcText("lc-stories", "empty")}</p>
        </div>`;
    const bg = this.background ? this.background(item) : "";
    const full = this.full;
    const timed = this.duration > 0;
    return html`
      <div class="fixed inset-0 flex flex-col"
        style="z-index:var(--lc-stories-z, 1200);background:var(--lc-stories-background, #000);touch-action:none;overscroll-behavior:contain"
        @wheel=${(/** @type {WheelEvent} */ e) => this._onWheel(e)}>
        ${full && bg ? html`<img src=${bg} alt="" class="absolute inset-0 h-full w-full object-cover" />` : ""}
        <div class="relative shrink-0 px-3 pb-1" style="padding-top:calc(0.5rem + var(--sat, env(safe-area-inset-top, 0px)))">
          <div class="flex gap-1">
            ${items.map((_, i) => html`<span class=${i < this.index ? "lc-stories-segment is-done h-0.5 flex-1 overflow-hidden rounded-full" : i === this.index ? "lc-stories-segment is-current h-0.5 flex-1 overflow-hidden rounded-full" : "lc-stories-segment h-0.5 flex-1 overflow-hidden rounded-full"}
              style="background:var(--lc-stories-progress-track, rgba(255,255,255,0.25))"
              @animationend=${i === this.index && timed ? () => this._onSegmentEnd() : nothing}>
              <span class="lc-stories-fill block h-full rounded-full" style="background:var(--lc-stories-progress-color, #fff);${i === this.index && timed ? `animation-duration:${this.duration}ms` : ""}"></span>
            </span>`)}
          </div>
          <div class="mt-2 flex items-center gap-2">
            ${this.header ? this.header(item, ctx) : ""}
            <span class="ml-auto text-xs font-bold text-white/50">${this.index + 1}/${items.length}</span>
            <button type="button" aria-label=${lcText("lc-stories", "close")} class="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10" @click=${() => this.close()}>
              <lc-icon name="x" size="20"></lc-icon>
            </button>
          </div>
        </div>

        <div class="relative min-h-0 flex-1" @click=${(/** @type {MouseEvent} */ e) => this._onTap(e)}>
          ${!full && bg ? html`<img src=${bg} alt="" class="absolute inset-0 h-full w-full object-cover opacity-30 blur-md" />` : ""}
          ${full
            ? html`<div class="absolute inset-0 flex items-stretch"><div class="h-full w-full">${this.media ? this.media(item, ctx) : ""}</div></div>`
            : html`<div class="absolute inset-0 mx-auto flex max-w-md items-stretch justify-center p-3">
                <div class="h-full w-full overflow-hidden rounded-2xl bg-black/60">${this.media ? this.media(item, ctx) : ""}</div>
              </div>`}
          ${this.tapZones ? "" : html`
          <div class="absolute bottom-3 right-3 flex flex-col gap-2">
            <button type="button" aria-label=${lcText("lc-stories", "prev")} ?disabled=${this.index === 0}
              class="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md disabled:opacity-30" @click=${() => this._go(-1)}>
              <lc-icon name=${this.axis === "x" ? "chevron-left" : "chevron-up"} size="20"></lc-icon>
            </button>
            <button type="button" aria-label=${lcText("lc-stories", "next")} ?disabled=${this.index >= items.length - 1}
              class="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md disabled:opacity-30" @click=${() => this._go(1)}>
              <lc-icon name=${this.axis === "x" ? "chevron-right" : "chevron-down"} size="20"></lc-icon>
            </button>
          </div>`}
        </div>

        <div class="relative shrink-0 px-4 pt-2" style="padding-bottom:calc(0.75rem + var(--sab, env(safe-area-inset-bottom, 0px)))">
          ${this.footer ? this.footer(item, ctx) : ""}
        </div>
      </div>`;
  },
});

/**
 * Fullscreen story viewer
 *
 * @component
 * @category app
 * @tag lc-stories
 *
 * A swipe-through fullscreen deck: segment progress bars, swipe / wheel /
 * keyboard / chevron navigation, close, counter, body scroll-lock, and a
 * blurred backdrop. It renders only the active item. The three app-specific
 * spots are render-callback props, each called `(item, ctx)` with
 * `ctx = { close, go, index, total }`. The overlay sits at
 * `--lc-stories-z` (1200), which an app raises when it has chrome of its
 * own above that.
 *
 * Four settings turn it into the story viewer a phone expects: `full` drops
 * the card frame so the media fills the screen and the backdrop is the media
 * itself, `axis="x"` swipes sideways, `tapZones` makes the left third of the
 * story go back and the rest go forward (the chevrons leave), and `duration`
 * in milliseconds fills the current segment and advances when it is full.
 * The bars read `--lc-stories-progress-color` and
 * `--lc-stories-progress-track`, the ground `--lc-stories-background`.
 *
 * @prop {boolean} full - The media fills the screen, no frame.
 * @prop {string} axis - `y` (default) or `x`: which way a swipe moves.
 * @prop {boolean} tapZones - Tap left to go back, elsewhere to go on.
 * @prop {number} duration - Milliseconds a story stays before advancing; 0 waits.
 *
 * @prop {unknown[]} items - The deck, one entry per story.
 * @prop {(item, ctx) => unknown} media - Required. The active item's media element.
 * @prop {(item) => string} background - Optional. URL for the blurred backdrop.
 * @prop {(item, ctx) => unknown} header - Optional. Identity row content.
 * @prop {(item, ctx) => unknown} footer - Optional. Caption / action content.
 * @event close - Emitted when the viewer closes.
 * @event index-change - `{ index }` when the active item changes.
 *
 * @example
 * ```js
 * const deck = this.querySelector("lc-stories");
 * deck.media = (item) => html`<video src=${item.url}></video>`;
 * deck.show(items, 0);
 * ```
 */
