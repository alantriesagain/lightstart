import T from "@bootstrapp/light/types";
import { defineMixin } from "@bootstrapp/light";

/** @import { Prop, SwipeHost, SwipeStart } from "../types.ts" */

/**
 * @bootstrapp/light/components/mixins/swipe-threshold
 *
 * A swipe nothing follows: two samples, one decision. Where `withPointerDrag`
 * hands the host a position every frame, this one measures where the pointer
 * went down and where it came up, and calls `onSwipe(direction)` once if the
 * travel along `axis` cleared `threshold` and beat the other axis by `ratio`.
 * `direction` is -1 or 1 along that axis, so a host reads it without knowing
 * which axis it asked for.
 *
 *   import { defineComponent } from "@bootstrapp/light";
 *   import { withSwipeThreshold } from "@bootstrapp/light/components/mixins/swipe-threshold.js";
 *
 *   export default defineComponent({
 *     mixins: [withSwipeThreshold({ axis: "y", ratio: 1.2, enabled: "open" })],
 *     tag: "lc-stories",
 *     onSwipe(direction) { this._go(direction < 0 ? 1 : -1); },
 *   });
 *
 * A gesture the platform cancels is dropped rather than measured, and only the
 * pointer that started one can end it. Options: `axis` (default `x`), or
 * `axisProp`, the name of a host property that holds the axis, for a host
 * whose direction is a setting; `threshold` in px (default 60), `ratio` (how
 * far the chosen axis must beat the other, default 1), `enabled` (a property
 * name read at `pointerdown`), and `pointerTypes` (which input kinds count,
 * default all: pass `["touch"]` for a gesture only a finger should make).
 *
 * @param {{ axis?: "x" | "y", axisProp?: string, threshold?: number, ratio?: number, enabled?: string, pointerTypes?: string[] }} [options]
 */
export const withSwipeThreshold = ({ axis = "x", axisProp, threshold = 60, ratio = 1, enabled, pointerTypes } = {}) =>
  defineMixin({
    props: {
      _swipe: /** @type {Prop<SwipeStart | null>} */ (T.object({ reactive: false, defaultValue: null })),
    },

    connected() {
      const host = /** @type {SwipeHost} */ (this);
      const onDown = /** @type {EventListener} */ ((e) => {
        const point = /** @type {PointerEvent} */ (e);
        if (enabled && !this[enabled]) return;
        if (pointerTypes && !pointerTypes.includes(point.pointerType)) return;
        this._swipe = { pointerId: point.pointerId, x: point.clientX, y: point.clientY };
      });

      const onUp = /** @type {EventListener} */ ((e) => {
        const point = /** @type {PointerEvent} */ (e);
        const start = this._swipe;
        if (!start || point.pointerId !== start.pointerId) return;
        this._swipe = null;
        if (e.type !== "pointerup") return;
        const dx = point.clientX - start.x;
        const dy = point.clientY - start.y;
        const vertical = (axisProp ? this[axisProp] : axis) === "y";
        const along = vertical ? dy : dx;
        const across = vertical ? dx : dy;
        if (Math.abs(along) < threshold) return;
        if (Math.abs(along) <= Math.abs(across) * ratio) return;
        host.onSwipe?.(along < 0 ? -1 : 1);
      });

      this.addEventListener("pointerdown", onDown);
      this.addEventListener("pointerup", onUp);
      this.addEventListener("pointercancel", onUp);
      this.$own(() => {
        this.removeEventListener("pointerdown", onDown);
        this.removeEventListener("pointerup", onUp);
        this.removeEventListener("pointercancel", onUp);
        this._swipe = null;
      });
    },
  });

export default withSwipeThreshold;
