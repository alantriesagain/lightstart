import { defineMixin } from "@bootstrapp/light";
/** @import View from "@bootstrapp/light" */

/**
 * @bootstrapp/light/components/mixins/resize
 *
 * Redraw whenever the host's box changes: a `ResizeObserver` on the host that
 * calls the named method, once on connect and again on every resize, released
 * with the component. For canvas-backed views whose drawing depends on their
 * own pixel size (a waveform, a chart, a filmstrip).
 *
 *   import { defineComponent } from "@bootstrapp/light";
 *   import { withResize } from "@bootstrapp/light/components/mixins/resize.js";
 *
 *   export default defineComponent({
 *     mixins: [withResize("_draw")],
 *     tag: "my-wave",
 *     _draw() { drawInto(this.querySelector("canvas")); },
 *   });
 *
 * @template {string} K
 * @param {K} method the host method to call
 */
export const withResize = (method) => defineMixin({
  /** @this {View & Record<K, () => void>} */
  connected() {
    const observer = new ResizeObserver(() => this[method]());
    observer.observe(this);
    this.$own(() => observer.disconnect());
    this[method]();
  },
});

export default withResize;
