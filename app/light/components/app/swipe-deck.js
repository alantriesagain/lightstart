import { html } from "/app/__light-runtime__.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { withPointerDrag } from "../mixins/pointer-drag.js";

/** @import { Prop, SwipeDeckBackground, SwipeDeckEmpty, SwipeDeckLabels, SwipeDeckRenderer, SwipeDeckHistory } from "../types.js" */
/** @import { DragEnd, DragMove, DragStart } from "../types.js" */

const DEFAULT_LABELS = { skip: "Skip", save: "Save", undo: "Undo", counter: "{i} / {n}" };
const TAP_PX = 6;
const TOP = '[part="lc-swipe-deck-card"][data-depth="0"]';
const CONTROLS = "button, a, [role=button], input, select, textarea, label, lc-button, lc-link";

/** @param {string} raw @param {number} fallback */
const readMs = (raw, fallback) => {
  const v = raw.trim();
  if (!v) return fallback;
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith("ms") ? n : n * 1000;
};

export default defineComponent({
  mixins: [withPointerDrag({ handle: TOP, capture: true })],
  tag: "lc-swipe-deck",
  style: true,
  props: {
    items: /** @type {Prop<unknown[]>} */ (T.array({ defaultValue: [], attribute: false })),
    index: 0,
    card: /** @type {Prop<SwipeDeckRenderer | null>} */ (T.function()),
    footer: /** @type {Prop<SwipeDeckRenderer | null>} */ (T.function()),
    empty: /** @type {Prop<SwipeDeckEmpty | null>} */ (T.function()),
    background: /** @type {Prop<SwipeDeckBackground | null>} */ (T.function()),
    threshold: 90,
    peek: 2,
    labels: /** @type {Prop<SwipeDeckLabels | null>} */ (T.object({ defaultValue: null, attribute: false })),
    _busy: T.boolean({ reactive: false, defaultValue: false }),
    _tapOnControl: T.boolean({ reactive: false, defaultValue: false }),
    _cardEl: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _throwTimer: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _history: /** @type {Prop<SwipeDeckHistory[]>} */ (T.object({ reactive: false, defaultValue: null })),
  },
  events: {
    swipe: T.object({ props: { direction: T.string(), index: T.number(), item: T.object() } }),
    select: T.object({ props: { index: T.number(), item: T.object() } }),
    "index-change": T.object({ props: { index: T.number() } }),
    end: T.object({}),
    undo: T.object({ props: { index: T.number(), item: T.object() } }),
  },
  connected() {
    this._history = [];
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    this.setAttribute("role", "group");
    this.setAttribute("aria-roledescription", "card deck");
    const onKeydown = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "ArrowLeft") this.swipe("left");
      else if (e.key === "ArrowRight") this.swipe("right");
      else if (e.key === "Enter" || e.key === "ArrowDown") this.select();
      else if (e.key === "Backspace") this.undo();
      else return;
      e.preventDefault();
    };
    const stop = (/** @type {Event} */ e) => e.stopPropagation();
    this.addEventListener("keydown", onKeydown);
    this.addEventListener("pointerdown", stop);
    this.addEventListener("touchstart", stop, { passive: true });
    this.$own(() => {
      this.removeEventListener("keydown", onKeydown);
      this.removeEventListener("pointerdown", stop);
      this.removeEventListener("touchstart", stop);
      if (this._throwTimer) clearTimeout(this._throwTimer);
      this._throwTimer = null;
    });
  },
  /** @param {DragStart} d */
  onDragStart({ event }) {
    const target = event.target instanceof Element ? event.target : null;
    this._tapOnControl = !!target?.closest(CONTROLS);
    this._cardEl = /** @type {HTMLElement | null} */ (this.querySelector(TOP));
  },
  /** @param {DragMove} d */
  onDragMove({ dx, dy }) {
    const el = this._cardEl;
    if (!el || this._busy) return;
    const width = this.clientWidth || 320;
    const rotate = Number.parseFloat(getComputedStyle(this).getPropertyValue("--lc-swipe-deck-rotate")) || 12;
    el.style.transform = `translate(${dx}px, ${dy * 0.35}px) rotate(${(dx / width) * rotate}deg)`;
    this.dataset.dir = dx === 0 ? "" : dx > 0 ? "right" : "left";
    this.style.setProperty("--lc-swipe-deck-p", String(Math.min(Math.abs(dx) / this.threshold, 1)));
  },
  /** @param {DragEnd} d */
  onDragEnd({ dx, dy, cancelled }) {
    delete this.dataset.dir;
    this.style.removeProperty("--lc-swipe-deck-p");
    const el = this._cardEl;
    if (this._busy) return;
    if (!cancelled && Math.abs(dx) >= this.threshold && Math.abs(dx) > Math.abs(dy)) return this._commit(dx > 0 ? "right" : "left");
    if (el) el.style.transform = "";
    if (!cancelled && Math.abs(dx) < TAP_PX && Math.abs(dy) < TAP_PX && !this._tapOnControl) this.select();
  },
  /** @param {string} direction */
  swipe(direction) {
    if (this._busy || !this.items[this.index]) return;
    this._commit(direction === "left" ? "left" : "right");
  },
  select() {
    const item = this.items[this.index];
    if (item) this.$emit("select", { index: this.index, item });
  },
  undo() {
    const last = this._history.pop();
    if (!last) return;
    this.index = last.index;
    this.$emit("undo", { index: last.index, item: last.item });
    this.$emit("index-change", { index: this.index });
  },
  /** @param {number} index */
  to(index) {
    const next = Math.max(0, Math.min(index, this.items.length - 1));
    if (next === this.index) return;
    this.index = next;
    this.$emit("index-change", { index: next });
  },
  /** @param {unknown[]} items */
  reset(items) {
    this.items = items;
    this.index = 0;
    this._history = [];
  },
  /** @param {"left" | "right"} direction */
  _commit(direction) {
    const index = this.index;
    const item = this.items[index];
    if (!item) return;
    this._busy = true;
    const el = /** @type {HTMLElement | null} */ (this.querySelector(TOP));
    const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = readMs(getComputedStyle(this).getPropertyValue("--lc-swipe-deck-throw-duration"), 320);
    const finish = () => {
      this._throwTimer = null;
      if (el) {
        el.style.transform = "";
        el.style.opacity = "";
      }
      delete this.dataset.throw;
      this._history.push({ index, item, direction });
      this._busy = false;
      this.$emit("swipe", { direction, index, item });
      this.index = index + 1;
      this.$emit("index-change", { index: this.index });
      if (this.index >= this.items.length) this.$emit("end", {});
    };
    if (!el || reduce || duration <= 0) return finish();
    this.dataset.throw = direction;
    const sign = direction === "right" ? 1 : -1;
    el.style.transform = `translate(${sign * 120}%, 0) rotate(${sign * 18}deg)`;
    el.style.opacity = "0";
    this._throwTimer = setTimeout(finish, duration);
  },
  /** @param {number} index @param {number} depth */
  _ctx(index, depth) {
    return {
      index,
      total: this.items.length,
      depth,
      skip: () => this.swipe("left"),
      save: () => this.swipe("right"),
      open: () => this.select(),
      undo: () => this.undo(),
    };
  },
  render() {
    const items = this.items;
    const i = this.index;
    const item = items[i];
    const labels = { ...DEFAULT_LABELS, ...(this.labels || {}) };
    if (!item) return html`<div part="lc-swipe-deck-empty">${this.empty ? this.empty() : ""}</div>`;
    const total = items.length;
    const bg = this.background ? this.background(item) : "";
    const stack = [];
    for (let d = Math.min(this.peek, total - 1 - i); d >= 0; d--) {
      const it = items[i + d];
      stack.push(html`
        <div part="lc-swipe-deck-card" data-depth=${d} style=${`--lc-swipe-deck-depth:${d}`}>
          ${this.card ? this.card(it, this._ctx(i + d, d)) : ""}
          ${d === 0 ? html`<span part="lc-swipe-deck-tint" data-tint="save"></span><span part="lc-swipe-deck-tint" data-tint="skip"></span>` : ""}
        </div>`);
    }
    return html`
      <div part="lc-swipe-deck-stage" style=${bg ? `background-image:url(${bg})` : ""}>${stack}</div>
      ${this.footer ? html`<div part="lc-swipe-deck-footer">${this.footer(item, this._ctx(i, 0))}</div>` : ""}
      <div part="lc-swipe-deck-actions">
        <button type="button" part="lc-swipe-deck-action lc-swipe-deck-skip" aria-label=${labels.skip} @click=${() => this.swipe("left")}><lc-icon name="x" size="22"></lc-icon></button>
        <span part="lc-swipe-deck-counter" aria-live="polite">${labels.counter.replace("{i}", String(i + 1)).replace("{n}", String(total))}</span>
        <button type="button" part="lc-swipe-deck-action lc-swipe-deck-save" aria-label=${labels.save} @click=${() => this.swipe("right")}><lc-icon name="heart" size="22"></lc-icon></button>
      </div>`;
  },
});

/**
 * Swipe deck
 *
 * @component
 * @category app
 * @tag lc-swipe-deck
 *
 * A stack of cards where a throw to the right or the left is a decision.
 * Inline, not an overlay: the host decides where it lives and how tall it is.
 * The component owns the gesture, the stack geometry, the counter, the two
 * buttons that do what the gesture does, the keyboard (arrows, Enter,
 * Backspace) and reduced motion. Every card is drawn by the caller through
 * `card(item, ctx)`, with `ctx = { index, total, depth, skip, save, open,
 * undo }`; `depth` is 0 for the top card so the caller can load its image
 * eagerly and the ones behind lazily.
 *
 * A finger starting on the deck never reaches the ancestors: `pointerdown`
 * and `touchstart` stop at the host, so a deck inside a draggable sheet does
 * not drag the sheet. The top card renders at rest, with no entry animation.
 *
 * @prop {unknown[]} items - The deck.
 * @prop {number} index - The top card.
 * @prop {(item, ctx) => unknown} card - Required. Draws one card.
 * @prop {(item, ctx) => unknown} footer - Optional. Drawn under the stack for the top item.
 * @prop {() => unknown} empty - Optional. Drawn when the deck runs out.
 * @prop {(item) => string} background - Optional. A URL painted behind the stack.
 * @prop {number} threshold - Pixels of horizontal travel that commit a swipe (90).
 * @prop {number} peek - How many cards show behind the top one (2).
 * @prop {{ skip, save, undo, counter }} labels - Copy for the buttons and the counter (`{i} / {n}`).
 * @event swipe - `{ direction: "left" | "right", index, item }` once a card has left.
 * @event select - `{ index, item }` on a tap, Enter or ArrowDown.
 * @event index-change - `{ index }` whenever the top card changes.
 * @event end - When the last card has left.
 * @event undo - `{ index, item }` when a swipe is taken back.
 *
 * @example
 * ```js
 * html`<lc-swipe-deck .items=${points} .card=${(pt, ctx) => html`<img src=${pt.image} loading=${ctx.depth ? "lazy" : "eager"} />`}
 *   @swipe=${(e) => e.detail.direction === "right" ? save(e.detail.item) : skip(e.detail.item)}></lc-swipe-deck>`
 * ```
 */
