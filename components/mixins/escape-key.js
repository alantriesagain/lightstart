/**
 * @bootstrapp/light/components/mixins/escape-key
 *
 * Micro-mixin: wires a document-level Escape keydown listener that calls a
 * configurable handler. Attaches on `connected()`; cleanup is registered
 * through `this.$own()` so it runs automatically on disconnect. Used by
 * overlay widgets (drawer, bottom-sheet, etc.) that need to close on ESC
 * without using a native `<dialog>` (which gets ESC handling via the
 * browser's `cancel` event for free).
 *
 *   import { defineComponent } from "@bootstrapp/light";
 *   import { withEscapeKey } from "@bootstrapp/light/components/mixins/escape-key.js";
 *
 *   export default defineComponent({
 *     mixins: [withEscapeKey],
 *     tag: "lc-drawer",
 *     props: { open: false, persistent: false },
 *     onEscape() {
 *       if (this.open && !this.persistent) this.closeDrawer();
 *     },
 *     // ...
 *   });
 *
 * The component implements `onEscape()` (called with the keydown event).
 * Component decides whether to act (e.g. only when `open && !persistent`).
 */
import { defineMixin } from "@bootstrapp/light";

/** @import { EscapeKeyHost } from "../types.ts" */

export const withEscapeKey = defineMixin({
  connected() {
    const host = /** @type {EscapeKeyHost} */ (this);
    /** @param {KeyboardEvent} e */
    const handler = (e) => {
      if (e.key === "Escape" && typeof host.onEscape === "function")
        host.onEscape(e);
    };
    document.addEventListener("keydown", handler);
    this.$own(() => document.removeEventListener("keydown", handler));
  },
});

export default withEscapeKey;
