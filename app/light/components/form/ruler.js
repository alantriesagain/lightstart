import { html } from "/app/__light-runtime__.js";
import { defineComponent } from "/app/light/view/index.js";
import { withPointerDrag } from "/app/light/components/mixins/pointer-drag.js";
import T from "/app/light/types/types.js";

/** @import { Prop } from "../types.js" */

/**
 * A ruler of discrete stops under a fixed mark: the items slide, the mark
 * stays. `items` are the printed labels, `value` the index under the mark,
 * `minor` the unlabelled ticks between two labels, `step` the pixels one
 * tick is wide. A drag or a wheel turns it; a tap on a label jumps to it;
 * the arrow keys step it. `input` fires while it turns, `change` when the
 * finger lifts.
 */
export default defineComponent({
  mixins: [withPointerDrag({ touchFallback: true })],
  tag: "lc-ruler",
  props: {
    items: /** @type {Prop<Array<string | number>>} */ (T.array({ defaultValue: [] })),
    value: 0,
    minor: 2,
    step: 16,
    disabled: false,
    label: "",
    _base: T.number({ reactive: false, defaultValue: 0 }),
    _live: T.number({ reactive: false, defaultValue: -1 }),
  },
  events: {
    input: T.object({ value: T.number() }),
    change: T.object({ value: T.number() }),
  },
  style: true,
  role: "slider",
  connected() {
    this.tabIndex = this.disabled ? -1 : 0;
    const onKey = (/** @type {Event} */ e) => this._onKey(/** @type {KeyboardEvent} */ (e));
    const onWheel = (/** @type {Event} */ e) => this._onWheel(/** @type {WheelEvent} */ (e));
    this.addEventListener("keydown", onKey);
    this.addEventListener("wheel", onWheel, { passive: false });
    this.$own(() => {
      this.removeEventListener("keydown", onKey);
      this.removeEventListener("wheel", onWheel);
    });
  },
  updated() {
    this.setAttribute("aria-valuemin", "0");
    this.setAttribute("aria-valuemax", String(Math.max(0, this.items.length - 1)));
    this.setAttribute("aria-valuenow", String(this.value));
    this.setAttribute("aria-valuetext", String(this.items[this.value] ?? ""));
    if (this.label) this.setAttribute("aria-label", this.label);
    this.toggleAttribute("disabled", this.disabled);
    this.tabIndex = this.disabled ? -1 : 0;
    this.style.setProperty("--lc-ruler-step", `${this.step}px`);
    this.style.setProperty("--lc-ruler-offset", this._offset(this._live >= 0 ? this._live : this.value));
  },
  /** @param {number} index */
  _ticks(index) {
    return index * (this.minor + 1);
  },
  /** @param {number} index */
  _offset(index) {
    return `${-(this._ticks(index) * this.step + this.step / 2)}px`;
  },
  /** @param {number} index */
  _clamp(index) {
    return Math.max(0, Math.min(this.items.length - 1, Math.round(index)));
  },
  /** @param {number} index @param {"input" | "change"} kind */
  _settle(index, kind) {
    const next = this._clamp(index);
    if (kind === "change") {
      this._live = -1;
      if (next !== this.value) {
        this.value = next;
        this.$emit("input", { value: next });
      }
      this.$emit("change", { value: next });
      return;
    }
    if (next === this._live) return;
    this._live = next;
    this.style.setProperty("--lc-ruler-offset", this._offset(next));
    this.$emit("input", { value: next });
  },
  onDragStart() {
    this._base = this.value;
  },
  /** @param {{ dx: number }} d */
  onDragMove({ dx }) {
    if (this.disabled) return;
    this._settle(this._base - dx / (this.step * (this.minor + 1)), "input");
  },
  /** @param {{ dx: number, cancelled: boolean }} d */
  onDragEnd({ dx, cancelled }) {
    if (this.disabled) return;
    this._settle(cancelled ? this.value : this._base - dx / (this.step * (this.minor + 1)), "change");
  },
  /** @param {WheelEvent} e */
  _onWheel(e) {
    if (this.disabled) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta) return;
    e.preventDefault();
    this._settle(this.value + Math.sign(delta), "change");
  },
  /** @param {KeyboardEvent} e */
  _onKey(e) {
    if (this.disabled) return;
    const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, Home: -Infinity, End: Infinity }[e.key];
    if (by === undefined) return;
    e.preventDefault();
    this._settle(by === -Infinity ? 0 : by === Infinity ? this.items.length - 1 : this.value + by, "change");
  },
  render() {
    const shown = this._live >= 0 ? this._live : this.value;
    const ticks = [];
    for (let i = 0; i < this.items.length; i++) {
      ticks.push(html`<button type="button" part="lc-ruler-label" class=${i === shown ? "label on" : "label"} tabindex="-1" ?disabled=${this.disabled} @click=${() => this._settle(i, "change")}><span part="lc-ruler-tick" class="tick major"></span><span part="lc-ruler-text">${this.items[i]}</span></button>`);
      if (i < this.items.length - 1) for (let m = 0; m < this.minor; m++) ticks.push(html`<span part="lc-ruler-tick" class="tick"></span>`);
    }
    return html`
      <div part="lc-ruler-track" class="track">${ticks}</div>
      <span part="lc-ruler-mark" class="mark" aria-hidden="true"></span>
    `;
  },
});

/**
 * Ruler
 *
 * @component
 * @category form
 * @tag lc-ruler
 *
 * A stop ruler: a row of printed values that slides under a fixed mark, the
 * way a camera's shutter and ISO are turned. One label per item, `minor`
 * ticks between them, `step` pixels per tick. Drag it, flick the wheel, tap
 * a label or use the arrow keys.
 *
 * @example Shutter speeds in thirds
 * ```html
 * <lc-ruler .items=${["1/30", "1/60", "1/125", "1/250", "1/500"]} value="2" minor="2"></lc-ruler>
 * ```
 */
