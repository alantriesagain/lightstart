import { defineMixin } from "@bootstrapp/light";

/** @import View from "@bootstrapp/light" */

/**
 * @bootstrapp/light/components/mixins/click-outside
 *
 * Micro-mixin: dismiss-on-outside-interaction. Attaches a document-level
 * listener on `connected()` (torn down via the View's `own()` registry) and
 * calls the component's `onClickOutside(e)` whenever the event's composed
 * path does not include the host. `composedPath()` is the one correct hit
 * test: it crosses shadow boundaries and survives the target being detached
 * by a re-render between the click and the listener.
 *
 *   import { defineComponent } from "@bootstrapp/light";
 *   import { withClickOutside } from "@bootstrapp/light/components/mixins/click-outside.js";
 *
 *   export default defineComponent({
 *     mixins: [withClickOutside()],
 *     tag: "lc-select",
 *     props: { open: false },
 *     onClickOutside() {
 *       if (this.open) this.open = false;
 *     },
 *   });
 *
 * Options: `events` (name or array: e.g. ["click", "contextmenu"] for a
 * context menu), `capture` (default true, so stopped propagation still
 * dismisses), `defer` (default true: attach on a 0-tick, so a widget spawned
 * BY a click never dismisses itself on the click that opened it).
 *
 * @param {{ events?: string | string[], capture?: boolean, defer?: boolean }} [options]
 */
export const withClickOutside = ({ events = "click", capture = true, defer = true } = {}) =>
  defineMixin({
    /** @this {View & { onClickOutside?: (e: Event) => void }} */
    connected() {
      const names = Array.isArray(events) ? events : [events];
      const handler = (/** @type {Event} */ e) => {
        if (e.composedPath().includes(this)) return;
        this.onClickOutside?.(e);
      };
      const attach = () => {
        for (const name of names) {
          document.addEventListener(name, handler, { capture });
          this.$own(() => document.removeEventListener(name, handler, { capture }));
        }
      };
      if (defer) {
        const timer = setTimeout(attach, 0);
        this.$own(() => clearTimeout(timer));
      } else attach();
    },
  });

export default withClickOutside;
