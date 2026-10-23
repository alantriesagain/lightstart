import T from "@bootstrapp/light/types";
import { defineMixin } from "@bootstrapp/light";
import { withPointerDrag } from "./pointer-drag.js";

/** @import { Prop, PullToRefreshHost } from "../types.ts" */

/**
 * @bootstrapp/light/components/mixins/pull-to-refresh
 *
 * The gesture a list of what-is-happening-now is expected to answer: drag down
 * from the top and it reloads. Built on `withPointerDrag`, so the pointer
 * bookkeeping, the frame coalescing and the teardown are not repeated here.
 *
 * It arms only when the page is already scrolled to the top, which is what
 * keeps it from fighting the scroller: a pull that starts mid-list is a scroll
 * and this never sees it. Anything that is not a pull down from the top (a
 * finger going up, a sideways swipe on a row, any move while unarmed) is
 * handed back to the page through `dragYields`, so the list keeps its native
 * scroll and its rows their own swipes. It follows the finger with resistance, so the hint
 * moves half as far as the thumb and the gesture feels attached without the
 * list leaving the screen.
 *
 * The host implements `onRefresh()` and may render off `pullY` (how far, in px)
 * and `refreshing` (whether the host's promise is still running). A host that
 * needs its own drag hooks should not use this: there is one `onDragMove` to go
 * round.
 *
 *   export default defineComponent({
 *     mixins: [withPullToRefresh()],
 *     tag: "my-list",
 *     async onRefresh() { await this.reload(); },
 *     render() { return html`<div style="transform:translateY(${this.pullY}px)">...</div>`; },
 *   });
 *
 * Options: `threshold` (px past which a release refreshes, default 64),
 * `resistance` (how much of the drag the hint travels, default 0.5), `max`
 * (px the hint stops at, default 96), `enabled` (a property name read at
 * `pointerdown`, so a view can disarm it while signed out), `mouse` (default
 * false: a pull is a touch gesture, and a mouse drag stays a text selection),
 * and `scroller` (the selector of the element whose scroll decides the top,
 * default `[data-scroller], [data-scroll-root]`, else the offset parent).
 *
 * @param {{ threshold?: number, resistance?: number, max?: number, enabled?: string, mouse?: boolean, scroller?: string }} [options]
 */
export const withPullToRefresh = ({ threshold = 64, resistance = 0.5, max = 96, enabled, mouse = false, scroller = "[data-scroller], [data-scroll-root]" } = {}) =>
  defineMixin({
    mixins: [withPointerDrag({ capture: false, touchFallback: true, enabled, mouse })],

    props: {
      pullY: T.number({ defaultValue: 0, attribute: false }),
      refreshing: T.boolean({ defaultValue: false, attribute: false }),
      _armed: T.boolean({ reactive: false, defaultValue: false }),
    },

    /** @type {() => number} */
    _scrollTop() {
      const el = this.closest(scroller) || this.offsetParent;
      return Number(el?.scrollTop ?? globalThis.scrollY ?? 0);
    },

    /** @param {{ dx: number, dy: number }} move */
    dragYields({ dx, dy }) {
      return !this._armed || dy < 0 || Math.abs(dx) > Math.abs(dy);
    },

    onDragStart() {
      this._armed = !this.refreshing && this._scrollTop() <= 0;
    },

    /** @param {{ dy: number }} move */
    onDragMove({ dy }) {
      if (!this._armed) return;
      this.pullY = dy <= 0 ? 0 : Math.min(dy * resistance, max);
    },

    /** @param {{ dy: number, cancelled?: boolean }} end */
    async onDragEnd({ dy, cancelled }) {
      const far = this._armed && !cancelled && dy * resistance >= threshold;
      this._armed = false;
      this.pullY = 0;
      if (!far || this.refreshing) return;

      this.refreshing = true;
      try { await /** @type {PullToRefreshHost} */ (this).onRefresh?.(); } finally { this.refreshing = false; }
    },
  });

export default withPullToRefresh;
