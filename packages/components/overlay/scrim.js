import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { withEscapeKey } from "@lightstart/components/mixins/escape-key.js";

export default defineComponent({
  mixins: [withEscapeKey],
  tag: "lc-scrim",
  style: true,
  props: {
    open: false,
    contained: false,
    blurred: false,
    dismissible: true,
  },
  events: {
    dismiss: T.object(),
  },
  connected() {
    const onClick = () => this._dismiss();
    this.addEventListener("click", onClick);
    this.$own(() => this.removeEventListener("click", onClick));
  },
  _dismiss() {
    if (!this.open || !this.dismissible) return;
    this.$emit("dismiss");
  },
  onEscape() {
    this._dismiss();
  },
});

/**
 * Scrim Component
 *
 * @component
 * @category overlay
 * @tag lc-scrim
 *
 * A backdrop over the viewport, or over its own container with `contained`,
 * drawn in the theme's `--canvas-backdrop` colour. `blurred` adds a
 * `backdrop-filter` whose radius is `--lc-scrim-blur` (the `blur` attribute works too). It is open while `open`
 * is set and never closes itself: a click or Escape emits `dismiss`, which the
 * owner answers by setting `open` back to false. `dismissible="false"` keeps
 * both to itself. It sits at `--lc-scrim-z-index` (900 by default), so a panel
 * goes above it with a higher `z-index` or its own layer variable.
 *
 * @example
 * ```html
 * <lc-scrim open @dismiss=${() => (this.editing = false)}></lc-scrim>
 * ```
 */
