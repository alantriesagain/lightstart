import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";

/** @import { Prop, DragState, PointerDragHost } from "../types.js" */

/**
 * @bootstrapp/light/components/mixins/pointer-drag
 *
 * A drag the host follows 1:1. The mixin owns the bookkeeping every drag needs
 * and no geometry: it gates the gesture, tracks one pointer, coalesces moves
 * into one animation frame, and releases everything on teardown. The host
 * declares what the deltas mean.
 *
 * Three hooks, all optional: `onDragStart({ x, y, event })` to snapshot
 * whatever the move needs, `onDragMove({ dx, dy, x, y })` once per frame, and
 * `onDragEnd({ dx, dy, x, y, cancelled })`. A pending frame is flushed before
 * `onDragEnd`, so the host never ends a drag one frame behind the finger.
 * While a drag runs the host carries a `dragging` attribute, which is where
 * `user-select: none` and a held cursor belong. A host that shares its area
 * with a scroller may also answer `dragYields({ dx, dy })`: true hands that
 * move back to the page, which ends the drag as cancelled and leaves the
 * browser to scroll, rather than holding the page still under the finger.
 *
 *   import { defineComponent } from "/app/light/view/index.js";
 *   import { withPointerDrag } from "/app/light/components/mixins/pointer-drag.js";
 *
 *   export default defineComponent({
 *     mixins: [withPointerDrag({ handle: "[part~=lc-split-pane-divider]", enabled: "resizable" })],
 *     tag: "lc-split-pane",
 *     onDragStart() { this._base = this.offsetWidth; },
 *     onDragMove({ dx }) { this.style.width = `${this._base + dx}px`; },
 *   });
 *
 * Options: `handle` (a selector matched against the event's `composedPath()`
 * up to the host, so `[part~=lc-split-pane-divider]` and
 * `[data-float-handle]` are the same option; omitted means anywhere in the
 * host), `enabled` (a property name read at `pointerdown`, never at connect
 * time, so toggling it arms and disarms the drag), `capture` (default true:
 * `setPointerCapture` on the host, which retargets every later event there;
 * false puts move, up and cancel on `document` for the duration instead, for
 * a drag that has to coexist with a scroller inside it), and `touchFallback`
 * (also drive the gesture from raw touch events, and let the pointer path
 * ignore `pointerType === "touch"`), and `mouse` (default true: false leaves a
 * mouse alone, so a touch gesture never costs a desktop its text selection).
 *
 * @param {{ handle?: string, enabled?: string, capture?: boolean, touchFallback?: boolean, mouse?: boolean }} [options]
 */
export const withPointerDrag = ({ handle, enabled, capture = true, touchFallback = false, mouse = true } = {}) =>
  defineMixin({
    props: {
      _drag: /** @type {Prop<DragState | null>} */ (T.object({ reactive: false, defaultValue: null })),
      _dragRaf: T.number({ reactive: false, defaultValue: 0 }),
    },

    connected() {
      const host = /** @type {PointerDragHost} */ (this);
      /** @param {Event} e */
      const onHandle = (e) => {
        if (!handle) return true;
        const path = e.composedPath();
        const host = path.indexOf(this);
        for (const node of host === -1 ? path : path.slice(0, host + 1))
          if (node instanceof Element && node.matches(handle)) return true;
        return false;
      };

      const flush = () => {
        this._dragRaf = 0;
        const d = this._drag;
        if (d) host.onDragMove?.({ dx: d.dx, dy: d.dy, x: d.x, y: d.y });
      };

      /**
       * @param {number} pointerId
       * @param {number} x
       * @param {number} y
       * @param {Event} event
       */
      const begin = (pointerId, x, y, event) => {
        this._drag = { pointerId, startX: x, startY: y, x, y, dx: 0, dy: 0 };
        this.setAttribute("dragging", "");
        host.onDragStart?.({ x, y, event });
      };

      /**
       * @param {number} x
       * @param {number} y
       */
      const move = (x, y) => {
        const d = this._drag;
        if (!d) return;
        d.x = x;
        d.y = y;
        d.dx = x - d.startX;
        d.dy = y - d.startY;
        if (this._dragRaf) return;
        this._dragRaf = requestAnimationFrame(flush);
      };

      /** @param {boolean} cancelled */
      const end = (cancelled) => {
        const d = this._drag;
        if (!d) return;
        if (this._dragRaf) {
          cancelAnimationFrame(this._dragRaf);
          flush();
        }
        this._drag = null;
        this.removeAttribute("dragging");
        host.onDragEnd?.({ dx: d.dx, dy: d.dy, x: d.x, y: d.y, cancelled });
      };

      /** @type {(() => void) | null} */
      let detachWindow = null;

      const release = () => {
        detachWindow?.();
        detachWindow = null;
      };

      /**
       * @param {number} x
       * @param {number} y
       * @returns {boolean}
       */
      const yields = (x, y) => {
        const d = this._drag;
        return Boolean(d && host.dragYields?.({ dx: x - d.startX, dy: y - d.startY }));
      };

      const onPointerMove = /** @type {EventListener} */ ((e) => {
        const point = /** @type {PointerEvent} */ (e);
        if (point.pointerId !== this._drag?.pointerId) return;
        if (yields(point.clientX, point.clientY)) {
          release();
          end(true);
          return;
        }
        move(point.clientX, point.clientY);
      });

      const onPointerEnd = /** @type {EventListener} */ ((e) => {
        const point = /** @type {PointerEvent} */ (e);
        if (point.pointerId !== this._drag?.pointerId) return;
        if (capture && this.hasPointerCapture(point.pointerId)) this.releasePointerCapture(point.pointerId);
        release();
        end(e.type === "pointercancel");
      });

      const onPointerDown = /** @type {EventListener} */ ((e) => {
        const point = /** @type {PointerEvent} */ (e);
        if (this._drag) return;
        if (enabled && !this[enabled]) return;
        if (touchFallback && point.pointerType === "touch") return;
        if (point.pointerType === "mouse" && (!mouse || point.button !== 0)) return;
        if (!onHandle(e)) return;
        e.preventDefault();
        if (capture) this.setPointerCapture(point.pointerId);
        else {
          document.addEventListener("pointermove", onPointerMove);
          document.addEventListener("pointerup", onPointerEnd);
          document.addEventListener("pointercancel", onPointerEnd);
          detachWindow = () => {
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerEnd);
            document.removeEventListener("pointercancel", onPointerEnd);
          };
        }
        begin(point.pointerId, point.clientX, point.clientY, e);
      });

      this.addEventListener("pointerdown", onPointerDown);
      this.$own(() => this.removeEventListener("pointerdown", onPointerDown));

      if (capture) {
        this.addEventListener("pointermove", onPointerMove);
        this.addEventListener("pointerup", onPointerEnd);
        this.addEventListener("pointercancel", onPointerEnd);
        this.$own(() => {
          this.removeEventListener("pointermove", onPointerMove);
          this.removeEventListener("pointerup", onPointerEnd);
          this.removeEventListener("pointercancel", onPointerEnd);
        });
      }

      if (touchFallback) {
        const TOUCH_ID = -1;
        const onTouchStart = /** @type {EventListener} */ ((e) => {
          const touch = /** @type {TouchEvent} */ (e);
          if (this._drag || touch.touches.length !== 1) return;
          if (enabled && !this[enabled]) return;
          if (!onHandle(e)) return;
          begin(TOUCH_ID, touch.touches[0].clientX, touch.touches[0].clientY, e);
        });
        const onTouchMove = /** @type {EventListener} */ ((e) => {
          const touch = /** @type {TouchEvent} */ (e);
          if (this._drag?.pointerId !== TOUCH_ID) return;
          const { clientX, clientY } = touch.touches[0];
          if (yields(clientX, clientY)) {
            end(true);
            return;
          }
          touch.preventDefault();
          move(clientX, clientY);
        });
        const onTouchEnd = /** @type {EventListener} */ ((e) => {
          const touch = /** @type {TouchEvent} */ (e);
          if (this._drag?.pointerId !== TOUCH_ID) return;
          const last = touch.changedTouches[0];
          if (last) move(last.clientX, last.clientY);
          end(e.type === "touchcancel");
        });
        this.addEventListener("touchstart", onTouchStart, { passive: true });
        this.addEventListener("touchmove", onTouchMove, { passive: false });
        this.addEventListener("touchend", onTouchEnd);
        this.addEventListener("touchcancel", onTouchEnd);
        this.$own(() => {
          this.removeEventListener("touchstart", onTouchStart);
          this.removeEventListener("touchmove", onTouchMove);
          this.removeEventListener("touchend", onTouchEnd);
          this.removeEventListener("touchcancel", onTouchEnd);
        });
      }

      this.$own(() => {
        release();
        if (this._dragRaf) cancelAnimationFrame(this._dragRaf);
        this._dragRaf = 0;
        this._drag = null;
      });
    },
  });

export default withPointerDrag;
