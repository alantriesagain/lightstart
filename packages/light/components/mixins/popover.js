import T from "@bootstrapp/light/types";
import { defineMixin } from "@bootstrapp/light";
import { withClickOutside } from "@bootstrapp/light/components/mixins/click-outside.js";
import { withOverlay } from "@bootstrapp/light/components/mixins/overlay.js";
import { anchorPosition, parseAnchor } from "../overlay/anchor.js";
import { env } from "@bootstrapp/light/env";

/** @import { Prop } from "../types.ts" */

/**
 * @bootstrapp/light/components/mixins/popover
 *
 * A layer anchored to whatever opened it: `toggle(trigger)` positions the host
 * against that element, keeps it there while the page scrolls or the viewport
 * changes, and takes it down on Escape or an outside click. The host stays
 * `position: fixed` in its own stylesheet and draws whatever it likes.
 *
 *   import { defineComponent } from "@bootstrapp/light";
 *   import { withPopover } from "@bootstrapp/light/components/mixins/popover.js";
 *
 *   export default defineComponent({
 *     mixins: [withPopover],
 *     tag: "lc-dropdown",
 *     style: true,
 *   });
 *
 * The trigger protocol is `toggle(trigger)`, `_open(trigger)` and `_close()`,
 * which is what `<lc-link popovertarget>` calls and what every direct caller
 * across the repo already holds. Opening fires `popover-open` and closing
 * fires `popover-close`, both bubbling.
 */
export const withPopover = defineMixin({
  mixins: [withClickOutside(), withOverlay()],

  props: {
    position: "bottom-left",
    open: false,
    offset: 4,
    _triggerElement: /** @type {Prop<Element | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _reposition: /** @type {Prop<(() => void) | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },

  connected() {
    if (!this.open)
      this.style.display = "none";

    this.$own(() => this._stopPositionTracking());
  },

  _updatePosition() {
    const trigger = this._triggerElement;
    if (!trigger) return;

    const { side, align } = parseAnchor(this.position, "start");
    const { top, left } = anchorPosition({
      trigger: trigger.getBoundingClientRect(),
      floating: this.getBoundingClientRect(),
      side,
      align,
      offset: this.offset,
      viewport: { width: env.width, height: env.height },
    });
    this.style.top = `${top}px`;
    this.style.left = `${left}px`;
  },

  /** @param {Element | null} triggerElement */
  _open(triggerElement) {
    if (this.open) return;

    this._triggerElement = triggerElement;
    this.open = true;
    this.style.display = "";
    this.setAttribute("data-open", "");

    this._startPositionTracking();

    this.dispatchEvent(new CustomEvent("popover-open", { bubbles: true }));
  },

  _close() {
    if (!this.open) return;

    this.open = false;
    this.style.display = "none";
    this.removeAttribute("data-open");
    this._stopPositionTracking();
    this._triggerElement = null;

    this.dispatchEvent(new CustomEvent("popover-close", { bubbles: true }));
  },

  close() {
    this._close();
  },

  /** @param {Element | null} triggerElement */
  toggle(triggerElement) {
    if (this.open)
      this._close();
     else
      this._open(triggerElement);

  },

  _startPositionTracking() {
    if (this._reposition) return;
    const onScroll = () => this._updatePosition();
    const offEnv = env.subscribe(() => this._updatePosition());
    this._updatePosition();
    globalThis.addEventListener("scroll", onScroll, true);
    this._reposition = () => {
      globalThis.removeEventListener("scroll", onScroll, true);
      offEnv();
    };
  },

  _stopPositionTracking() {
    this._reposition?.();
    this._reposition = null;
  },

  onEscape() {
    this._close();
  },

  /** @param {Event} e */
  onClickOutside(e) {
    if (!this.open) return;
    if (this._triggerElement && e.composedPath().includes(this._triggerElement)) return;
    this._close();
  },
});

export default withPopover;
