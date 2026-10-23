import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

const TAG = "lc-clipboard";

/**
 * Clipboard Component
 *
 * @component
 * @category utility
 * @tag lc-clipboard
 *
 * A button that copies a text and says so for a moment.
 *
 * @example
 * ```html
 * <lc-clipboard text="npm install @bootstrapp/light"></lc-clipboard>
 * <lc-clipboard text="<lc-button></lc-button>" icon-only></lc-clipboard>
 * ```
 */
export default defineComponent({
  tag: "lc-clipboard",
  icons: ["copy", "check"],
  style: true,
  props: {
    text: "",
    label: "",
    copiedLabel: "",
    iconOnly: T.boolean(),
    size: T.string({ defaultValue: "sm", enum: ["xs", "sm", "md"] }),
    timeout: 1400,
    copied: T.boolean(),
    _timer: T.number({ defaultValue: 0, reactive: false }),
  },
  events: {
    copy: T.object(),
  },
  async _copy() {
    await navigator.clipboard.writeText(this.text);
    this.copied = true;
    this.$emit("copy", { text: this.text });
    clearTimeout(this._timer);
    this._timer = window.setTimeout(() => {
      this.copied = false;
    }, this.timeout);
  },
  disconnected() {
    clearTimeout(this._timer);
  },
  render() {
    const label = this.copied ? this.copiedLabel || lcText(TAG, "copied") : this.label || lcText(TAG, "copy");
    return html`
      <lc-button
        class="clipboard-button"
        ghost
        size=${this.size}
        icon=${this.copied ? "check" : "copy"}
        ?icon-only=${this.iconOnly}
        title=${label}
        aria-label=${label}
        @click=${this._copy}
      >${this.iconOnly ? "" : label}</lc-button>
    `;
  },
});
