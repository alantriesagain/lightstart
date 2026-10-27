import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";
import { overlays } from "../overlay/stack.js";

/** @import { OverlayHost, Prop } from "../types.js" */

/**
 * @bootstrapp/light/components/mixins/overlay
 *
 * Micro-mixin: put a component on the overlay stack while it is open. The host
 * declares which of its properties means "open"; the mixin registers on the way
 * up and releases on the way down, including on disconnect, so a layer removed
 * mid-open does not hold the scroll lock.
 *
 * A host that answers Escape declares `onEscape()`, and the stack calls it only
 * while the host is the topmost layer that will take one. A host without it
 * joins for the accounting and the lock, and Escape passes it by.
 *
 *   import { defineComponent } from "/app/light/view/index.js";
 *   import { withOverlay } from "/app/light/components/mixins/overlay.js";
 *
 *   export default defineComponent({
 *     mixins: [withOverlay({ lockScroll: true })],
 *     tag: "lc-drawer",
 *     props: { open: false },
 *     onEscape() { this.close(); },
 *   });
 *
 * Options: `prop` (which property means open, default `open`), `lockScroll`,
 * `restoreFocus`, and `dismissible` for a native `<dialog>`, which answers
 * Escape and restores focus itself and so declares neither.
 *
 * @param {{ prop?: string, lockScroll?: boolean, restoreFocus?: boolean, dismissible?: boolean }} [options]
 */
export const withOverlay = ({ prop = "open", lockScroll = false, restoreFocus = true, dismissible } = {}) =>
  defineMixin({
    props: {
      _overlayId: /** @type {Prop<string | null>} */ (T.string({ attribute: false, defaultValue: null })),
    },

    /** @param {{ changedProps: Map<string, unknown> }} arg */
    updated({ changedProps }) {
      if (!changedProps.has(prop)) return;
      const host = /** @type {OverlayHost} */ (this);
      if (this[prop] && !this._overlayId)
        this._overlayId = overlays.open(this, {
          lockScroll,
          restoreFocus,
          dismissible: dismissible ?? typeof host.onEscape === "function",
          dismiss: () => host.onEscape?.(),
        });
      else if (!this[prop] && this._overlayId) {
        overlays.close(this._overlayId);
        this._overlayId = null;
      }
    },

    disconnected() {
      if (!this._overlayId) return;
      overlays.close(this._overlayId);
      this._overlayId = null;
    },
  });

export default withOverlay;
