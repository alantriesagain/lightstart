import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { withPointerDrag } from "../mixins/pointer-drag.js";

/** @import { Prop, DragMove } from "../types.ts" */

export default defineComponent({
  mixins: [withPointerDrag({ enabled: "resizable" })],
  tag: "lc-divider",
  style: true,
  props: {
    label: T.string(),
    vertical: T.boolean(),
    resizable: false,
    key: T.string(),
    minPrev: 0,
    minNext: 0,
    maxPrev: 0,
    maxNext: 0,
    prevSize: T.number({ sync: "local", scope: "key" }),
    nextSize: T.number({ sync: "local", scope: "key" }),
    _prevElem: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _nextElem: /** @type {Prop<HTMLElement | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _start: /** @type {Prop<{ prevW: number, nextW: number, prevH: number, nextH: number } | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
  },

  firstUpdated() {
    this._restoreSizes();
  },

  /** A size kept within the bounds a side declares; 0 means unbounded. @param {number} size @param {number} min @param {number} max */
  _clamp(size, min, max) {
    const floor = Math.max(size, min || 0);
    return max ? Math.min(floor, max) : floor;
  },

  _restoreSizes() {
    if (!this.key) return;
    const prev = /** @type {HTMLElement | null} */ (this.previousElementSibling);
    const next = /** @type {HTMLElement | null} */ (this.nextElementSibling);
    if (prev && this.prevSize) prev.style.flexBasis = `${this._clamp(this.prevSize, this.minPrev, this.maxPrev)}px`;
    if (next && this.nextSize) next.style.flexBasis = `${this._clamp(this.nextSize, this.minNext, this.maxNext)}px`;
  },

  onDragStart() {
    const prev = /** @type {HTMLElement | null} */ (this.previousElementSibling);
    const next = /** @type {HTMLElement | null} */ (this.nextElementSibling);
    this._prevElem = prev;
    this._nextElem = next;
    this._start = {
      prevW: prev ? prev.offsetWidth : 0,
      nextW: next ? next.offsetWidth : 0,
      prevH: prev ? prev.offsetHeight : 0,
      nextH: next ? next.offsetHeight : 0,
    };
  },

  /** @param {DragMove} move */
  onDragMove({ dx, dy }) {
    const start = this._start;
    if (!start || !this._prevElem || !this._nextElem) return;
    const delta = this.vertical ? dx : dy;
    const total = (this.vertical ? start.prevW : start.prevH) + (this.vertical ? start.nextW : start.nextH);
    let prev = this._clamp((this.vertical ? start.prevW : start.prevH) + delta, this.minPrev, this.maxPrev);
    let next = total - prev;
    if (next < (this.minNext || 0) || (this.maxNext && next > this.maxNext)) {
      next = this._clamp(next, this.minNext, this.maxNext);
      prev = total - next;
    }
    if (prev <= 0 || next <= 0) return;
    this._prevElem.style.flexBasis = `${prev}px`;
    this._nextElem.style.flexBasis = `${next}px`;
  },

  onDragEnd() {
    if (this.key) {
      const dim = this.vertical ? "offsetWidth" : "offsetHeight";
      if (this._prevElem) this.prevSize = this._prevElem[dim];
      if (this._nextElem) this.nextSize = this._nextElem[dim];
    }
    this._start = null;
    this._prevElem = null;
    this._nextElem = null;
  },

  render() {
    return !this.label ? null : html`<span>${this.label}</span>`;
  },
});
