import { html, svg } from "/app/__light-runtime__.js";
import { encode } from "/app/qr/encode.js";
import { toPath } from "/app/qr/svg.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { lcText } from "/app/light/components/utils/text.js";
import words from "../locales/en.js";

/** @import { Prop } from "/app/light/components/types.js" */
/** @import { QrLevel } from "/app/qr/types.js" */

/**
 * QR Code Component
 *
 * @component
 * @category display
 * @tag qr-code
 *
 * Encodes `value` with `@bootstrapp/qr` and draws it as one inline SVG
 * path in `currentColor`, a quiet zone of `margin` modules in the
 * viewBox, crisp edges. The encoding is memoized on `value` and `level`,
 * so re-renders for other reasons do not re-encode.
 *
 * @example
 * ```html
 * <qr-code value="https://example.com" size="200"></qr-code>
 * ```
 */
export default defineComponent({
  tag: "qr-code",
  props: {
    value: "",
    level: /** @type {Prop<QrLevel>} */ (
      T.string({ defaultValue: "M", enum: ["L", "M", "Q", "H"] })
    ),
    size: 200,
    margin: 1,
    label: "",
    _encodedKey: T.string({ reactive: false, defaultValue: "" }),
    _encoded: /** @type {Prop<ReturnType<typeof encode> | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },

  _matrix() {
    const key = `${this.level}\n${this.value}`;
    if (this._encodedKey !== key) {
      this._encodedKey = key;
      this._encoded = this.value ? encode(this.value, { level: this.level }) : null;
    }
    return this._encoded;
  },

  render() {
    const matrix = this._matrix();
    if (!matrix) return html``;
    const span = matrix.size + this.margin * 2;
    return html`<svg
      viewBox="0 0 ${span} ${span}"
      width=${this.size}
      height=${this.size}
      shape-rendering="crispEdges"
      role="img"
      aria-label=${this.label || lcText("qr-code", "label", {}, words["qr-code"])}
      data-version=${matrix.version}
    >${svg`<path fill="currentColor" d=${toPath(matrix, { margin: this.margin })} />`}</svg>`;
  },
});
