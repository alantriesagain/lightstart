import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import { formatHex, parseHex, sameColor } from "./color.js";
import { lcText } from "../utils/text.js";

/** @import { Prop } from "../types.ts" */

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-color-picker",
  style: true,
  props: {
    value: "",
    alpha: false,
    swatches: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    allowClear: false,
    _draft: "",
  },
  connected() {
    this.syncFormValue(this.value);
  },
  /** @param {string} next @param {"input" | "change"} event */
  _commit(next, event) {
    if (next === this.value) return;
    this.value = next;
    this.syncFormValue(next);
    this.$emit(event, { value: next });
  },
  _locked() {
    return this.disabled || this.readonly;
  },
  /** @param {Event} e */
  _onPicker(e) {
    e.stopPropagation();
    if (this._locked()) return;
    const { alpha } = parseHex(this.value);
    this._commit(formatHex(/** @type {HTMLInputElement} */ (e.target).value, alpha, this.alpha), e.type === "input" ? "input" : "change");
  },
  /** @param {Event} e */
  _onHexInput(e) {
    e.stopPropagation();
    if (this._locked()) return;
    this._draft = /** @type {HTMLInputElement} */ (e.target).value;
    const typed = parseHex(this._draft);
    if (!typed.hex) return;
    const { alpha } = parseHex(this.value);
    this._commit(formatHex(typed.hex, typed.alpha ?? alpha, this.alpha), "input");
  },
  /** @param {Event} e */
  _onHexDone(e) {
    if (e instanceof KeyboardEvent && e.key !== "Enter") return;
    e.stopPropagation();
    const typed = parseHex(this._draft);
    if (typed.hex) {
      const { alpha } = parseHex(this.value);
      this._commit(formatHex(typed.hex, typed.alpha ?? alpha, this.alpha), "change");
    }
    this._draft = "";
  },
  /** @param {Event} e */
  _onAlpha(e) {
    e.stopPropagation();
    if (this._locked()) return;
    const { hex } = parseHex(this.value);
    const pct = Number(/** @type {HTMLInputElement} */ (e.target).value);
    this._commit(formatHex(hex || "#000000", pct / 100, true), e.type === "input" ? "input" : "change");
  },
  /** @param {string} swatch */
  _pickSwatch(swatch) {
    if (this._locked()) return;
    const picked = parseHex(swatch);
    this._commit(formatHex(picked.hex, picked.alpha, this.alpha), "change");
  },
  _clear() {
    if (this._locked()) return;
    this._commit("", "change");
  },
  render() {
    const { hex, alpha } = parseHex(this.value);
    const percent = Math.round((alpha ?? 1) * 100);
    const shown = this._draft || this.value;
    const locked = this._locked();
    return html`
      <div class="lc-color-picker-row">
        <span class="lc-color-picker-swatch" style="--lc-color-picker-value: ${hex || "transparent"}; --lc-color-picker-opacity: ${alpha ?? 1}">
          <input
            type="color"
            class="lc-color-picker-native"
            .value=${hex || "#000000"}
            ?disabled=${locked}
            aria-label=${lcText("lc-color-picker", "pick")}
            @input=${this._onPicker}
            @change=${this._onPicker}
          />
        </span>
        <input
          type="text"
          class="lc-color-picker-hex"
          id=${this.getInputId()}
          name=${this.name || nothing}
          .value=${shown}
          placeholder=${this.placeholder || "#000000"}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          spellcheck="false"
          autocomplete="off"
          @input=${this._onHexInput}
          @blur=${this._onHexDone}
          @keydown=${this._onHexDone}
        />
        ${this.alpha
          ? html`
            <input
              type="range"
              class="lc-color-picker-alpha"
              min="0"
              max="100"
              step="1"
              .value=${String(percent)}
              ?disabled=${locked}
              aria-label=${lcText("lc-color-picker", "opacity")}
              @input=${this._onAlpha}
              @change=${this._onAlpha}
            />
            <span class="lc-color-picker-percent">${percent}%</span>
          `
          : nothing}
        ${this.allowClear && this.value
          ? html`<button type="button" class="lc-color-picker-clear" aria-label=${lcText("lc-color-picker", "clear")} ?disabled=${locked} @click=${this._clear}><lc-icon name="x" size="12"></lc-icon></button>`
          : nothing}
      </div>
      ${this.swatches.length
        ? html`
          <div class="lc-color-picker-swatches" role="listbox" aria-label=${lcText("lc-color-picker", "swatches")}>
            ${this.swatches.map((swatch) => html`
              <button
                type="button"
                role="option"
                class="lc-color-picker-chip"
                aria-selected=${sameColor(swatch, this.value) ? "true" : "false"}
                aria-label=${swatch}
                style="--lc-color-picker-value: ${parseHex(swatch).hex || "transparent"}; --lc-color-picker-opacity: ${parseHex(swatch).alpha ?? 1}"
                ?disabled=${locked}
                @click=${() => this._pickSwatch(swatch)}
              ></button>
            `)}
          </div>
        `
        : nothing}
    `;
  },
});

/**
 * Color Picker Component
 *
 * @component
 * @category form
 * @tag lc-color-picker
 *
 * A colour as a form control: a swatch that opens the platform picker, a hex
 * field that takes any spelling, an opacity slider when `alpha` is on, a row
 * of `swatches` to pick from, and a clear button when `allowClear` is on.
 * The value is `#rrggbb`, or `#rrggbbaa` when alpha is tracked and below 1;
 * `input` follows every edit and `change` lands on a pick, a slider release
 * or leaving the hex field.
 *
 * @example A text colour with the brand swatches
 * ```html
 * <lc-color-picker value="#ffffff" .swatches=${["#ff725e", "#ffbf3c", "#1d2021", "#f3efec"]}></lc-color-picker>
 * ```
 *
 * @example A background with opacity and a way to clear it
 * ```html
 * <lc-color-picker value="#1d202180" alpha allowClear></lc-color-picker>
 * ```
 */
