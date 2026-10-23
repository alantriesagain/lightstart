import T from "@bootstrapp/light/types";
import { clampRect, loadRect, saveRect } from "./float-rect.js";
import { defineComponent } from "@bootstrapp/light";
import { withPointerDrag } from "../mixins/pointer-drag.js";
import { env } from "@bootstrapp/light/env";

/** @import { Prop, DragMove } from "../types.ts" */

const EDGE_GAP_PX = 16;

export default defineComponent({
  mixins: [withPointerDrag({ handle: "[data-float-handle]" })],
  tag: "lc-float-panel",
  style: true,
  props: {
    storageKey: "",
    panelWidth: 380,
    panelHeight: 500,
    minWidth: 280,
    minHeight: 320,
    _rect: /** @type {Prop<{ x: number, y: number, w: number, h: number }>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
    _dragBase: /** @type {Prop<{ x: number, y: number } | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
  },
  events: {
    "panel-moved": T.object({ x: T.number(), y: T.number() }),
    "panel-resized": T.object({ w: T.number(), h: T.number() }),
  },

  connected() {
    const viewport = this._viewport();
    const fallback = {
      x: viewport.width - this.panelWidth - EDGE_GAP_PX,
      y: viewport.height - this.panelHeight - EDGE_GAP_PX,
      w: this.panelWidth,
      h: this.panelHeight,
    };
    const stored = this.storageKey ? loadRect(localStorage, this.storageKey, fallback) : fallback;
    this._rect = clampRect(stored, viewport, this._mins());
    this._apply();

    const observer = new ResizeObserver(() => {
      if (this._drag) return;
      const w = this.offsetWidth;
      const h = this.offsetHeight;
      if (!w || !h || (w === this._rect.w && h === this._rect.h)) return;
      this._rect.w = Math.max(this.minWidth, w);
      this._rect.h = Math.max(this.minHeight, h);
      this._persist();
      this.$emit("panel-resized", { w: this._rect.w, h: this._rect.h });
    });
    observer.observe(this);
    this.$own(() => observer.disconnect());

    this.$own(env.subscribe(() => {
      this._rect = clampRect(this._rect, this._viewport(), this._mins());
      this._apply();
      this._persist();
    }));
  },

  onDragStart() {
    this._dragBase = { x: this._rect.x, y: this._rect.y };
  },

  /** @param {DragMove} move */
  onDragMove({ dx, dy }) {
    const base = this._dragBase;
    if (!base) return;
    this._rect.x = base.x + dx;
    this._rect.y = base.y + dy;
    this._apply();
  },

  onDragEnd() {
    this._dragBase = null;
    this._rect = clampRect(this._rect, this._viewport(), this._mins());
    this._apply();
    this._persist();
    this.$emit("panel-moved", { x: this._rect.x, y: this._rect.y });
  },

  _viewport() {
    return { width: env.width, height: env.height };
  },

  _mins() {
    return { minWidth: this.minWidth, minHeight: this.minHeight };
  },

  _apply() {
    this.style.left = `${this._rect.x}px`;
    this.style.top = `${this._rect.y}px`;
    this.style.width = `${this._rect.w}px`;
    this.style.height = `${this._rect.h}px`;
    this.style.minWidth = `${this.minWidth}px`;
    this.style.minHeight = `${this.minHeight}px`;
  },

  _persist() {
    if (this.storageKey) saveRect(localStorage, this.storageKey, this._rect);
  },
});

/**
 * Float Panel Component
 *
 * @component
 * @category overlay
 * @tag lc-float-panel
 *
 * A desktop floating window primitive: fixed-position, dragged by any child
 * matching `[data-float-handle]` (pointer capture, 1:1), resized through
 * native CSS `resize: both` read back by a ResizeObserver. The rect is
 * clamped to the viewport on drag end and window resize (at least 48px of
 * the handle stays reachable) and persisted to localStorage as `{x,y,w,h}`
 * when `storageKey` is set. Defaults to the bottom-right corner. Light DOM:
 * the consumer renders its own handle row and body as children.
 *
 * @example
 * ```html
 * <lc-float-panel storage-key="notes-float-rect">
 *   <div data-float-handle class="flex items-center gap-2 px-2 py-1.5">Notes</div>
 *   <div class="flex-1 min-h-0 overflow-auto">…</div>
 * </lc-float-panel>
 * ```
 */
