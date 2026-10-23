import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import T from "@bootstrapp/light/types";
import { lcText } from "../utils/text.js";

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-slider",
  props: {
    _dragging: T.boolean({ reactive: false, defaultValue: false }),
    value: 50,
    min: 0,
    max: 100,
    step: 1,
    variant: T.string({
      defaultValue: "primary",
      enum: ["primary", "secondary", "success", "warning", "error"],
    }),
    nofill: false,
    steppers: false,
  },
  style: true,

  connected() {
    this.syncFormValue(this.value.toString());
  },

  willUpdate() {
    const clamped = Math.min(this.max, Math.max(this.min, this.value));
    if (clamped !== this.value) this.value = clamped;
  },

  firstUpdated() {
    this._syncInput(true);
    this._syncFill();
  },

  updated() {
    this._syncInput(false);
    this._syncFill();
  },

  _syncFill() {
    const pct = this.max > this.min ? ((this.value - this.min) / (this.max - this.min)) * 100 : 0;
    this.style.setProperty("--lc-slider-fill", `${pct}%`);
  },

  /** @param {boolean} force */
  _syncInput(force) {
    if (this._dragging && !force) return;
    const input = /** @type {HTMLInputElement | null} */ (this.querySelector("input.slider"));
    const next = this.value.toString();
    if (input && input.value !== next) input.value = next;
  },

  _endDrag() {
    this._dragging = false;
    this._syncInput(true);
  },

  /**
   * @param {Event} e
   * @param {string} event
   */
  _commit(e, event) {
    e.stopPropagation();
    this.value = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
    this.syncFormValue(this.value.toString());
    this.$emit(event, { value: this.value });
  },

  /** @param {number} direction */
  _nudge(direction) {
    const decimals = (String(this.step).split(".")[1] ?? "").length;
    const raw = this.value + direction * this.step;
    const next = Math.min(this.max, Math.max(this.min, Number(raw.toFixed(decimals))));
    if (next === this.value) return;
    this.value = next;
    this.syncFormValue(this.value.toString());
    this.$emit("input", { value: this.value });
    this.$emit("change", { value: this.value });
  },

  /**
   * @param {number} direction
   * @param {string} label
   * @param {string} glyph
   */
  _stepper(direction, label, glyph) {
    const atLimit = direction < 0 ? this.value <= this.min : this.value >= this.max;
    return html`
      <button
        type="button"
        class="slider-step"
        aria-label=${label}
        ?disabled=${this.disabled || atLimit}
        @click=${() => this._nudge(direction)}
      >${glyph}</button>`;
  },

  render() {
    const input = html`
      <input
        type="range"
        class="slider${this.nofill ? " slider-nofill" : ""}"
        id=${this.getInputId()}
        min=${this.min}
        max=${this.max}
        step=${this.step}
        ?disabled=${this.disabled}
        ?required=${this.required}
        name=${this.name}
        aria-label=${this.label || this.name || lcText("lc-slider", "label")}
        @pointerdown=${() => (this._dragging = true)}
        @pointerup=${() => this._endDrag()}
        @pointercancel=${() => this._endDrag()}
        @blur=${() => this._endDrag()}
        @input=${(e) => this._commit(e, "input")}
        @change=${(e) => this._commit(e, "change")}
      />`;
    if (!this.steppers) return input;
    return html`
      <div class="slider-row">
        ${this._stepper(-1, "Decrease", "−")}
        ${input}
        ${this._stepper(1, "Increase", "+")}
      </div>`;
  },
});

/**
 * Slider Component
 *
 * @component
 * @category form
 * @tag lc-slider
 *
 * A range slider input for selecting numeric values.
 *
 * @example Basic Slider
 * ```html
 * <lc-slider value="50"></lc-slider>
 * ```
 *
 * @example With Min, Max, and Step
 * ```html
 * <lc-slider min="0" max="10" step="0.5" value="5"></lc-slider>
 * ```
 *
 * @example Size Variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-slider size="xs" value="25"></lc-slider>
 *   <lc-slider size="sm" value="50"></lc-slider>
 *   <lc-slider size="md" value="75"></lc-slider>
 *   <lc-slider size="lg" value="50"></lc-slider>
 *   <lc-slider size="xl" value="25"></lc-slider>
 * </div>
 * ```
 *
 * @example Color Variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-slider variant="primary" value="70"></lc-slider>
 *   <lc-slider variant="secondary" value="60"></lc-slider>
 *   <lc-slider variant="success" value="80"></lc-slider>
 *   <lc-slider variant="warning" value="40"></lc-slider>
 *   <lc-slider variant="error" value="30"></lc-slider>
 * </div>
 * ```
 *
 * @example Disabled State
 * ```html
 * <lc-slider value="60" disabled></lc-slider>
 * ```
 *
 * @example With Event Handling
 * ```js
 * html`<lc-slider
 *   value="50"
 *   @input=${(e) => console.log('Current:', e.detail.value)}
 *   @change=${(e) => console.log('Final:', e.detail.value)}
 * ></lc-slider>`
 * ```
 *
 * @example In a Form
 * ```html
 * <form>
 *   <label>Volume: <lc-slider name="volume" min="0" max="100" value="50"></lc-slider></label>
 *   <button type="submit">Submit</button>
 * </form>
 * ```
 */
