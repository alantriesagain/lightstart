import { html, nothing } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import T from "@bootstrapp/light/types";
import { lcText } from "../utils/text.js";

/** @import { Prop } from "../types.ts" */

const HOLD_DELAY = 350;
const MIN_INTERVAL = 45;

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-number-input",
  props: {
    _holdTimer: /** @type {Prop<ReturnType<typeof setTimeout> | null>} */ (T.object({ reactive: false, defaultValue: null })),
    value: /** @type {Prop<number | null>} */ (T.number({ defaultValue: null })),
    min: /** @type {Prop<number | null>} */ (T.number({ defaultValue: null })),
    max: /** @type {Prop<number | null>} */ (T.number({ defaultValue: null })),
    step: 1,
    showButtons: true,
    stepper: false,
    unit: "",
    display: "",
    editing: false,
  },
  style: true,

  connected() {
    this._updateFormValue();
  },

  _updateFormValue() {
    this.syncFormValue(this.value == null ? "" : String(this.value));
  },

  /** @param {Event} e */
  handleInput(e) {
    e.stopPropagation();
    const val = /** @type {HTMLInputElement} */ (e.target).value;
    this.value = val === "" ? null : parseFloat(val);
    this._updateFormValue();
    this.$emit("input", { value: this.value });
  },

  /** @param {Event} e */
  handleChange(e) {
    e.stopPropagation();
    const val = /** @type {HTMLInputElement} */ (e.target).value;
    this.value = val === "" ? null : parseFloat(val);
    this._updateFormValue();
    this.$emit("change", { value: this.value });
  },

  /** @param {number} delta */
  nudge(delta) {
    if (this.disabled || this.readonly) return;
    let next = (this.value || 0) + delta;
    if (this.min !== null) next = Math.max(this.min, next);
    if (this.max !== null) next = Math.min(this.max, next);
    next = Number(next.toFixed(10));
    if (next === this.value) return;
    this.value = next;
    this._updateFormValue();
    this.$emit("change", { value: this.value });
  },

  increment() {
    this.nudge(this.step);
  },

  decrement() {
    this.nudge(-this.step);
  },

  /** @param {number} direction */
  _holdStart(direction) {
    if (this.disabled || this.readonly) return;
    let count = 0;
    const tick = () => {
      count += 1;
      const stride = count < 8 ? 1 : count < 16 ? 4 : 10;
      this.nudge(direction * this.step * stride);
      this._holdTimer = setTimeout(tick, Math.max(MIN_INTERVAL, 200 - count * 12));
    };
    this._holdTimer = setTimeout(tick, HOLD_DELAY);
  },

  _holdStop() {
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = null;
  },

  disconnected() {
    this._holdStop();
  },

  _startEdit() {
    if (this.disabled || this.readonly || this.display) return;
    this.editing = true;
  },

  /** @param {string} raw */
  _commitEdit(raw) {
    this.editing = false;
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    let next = parsed;
    if (this.min !== null) next = Math.max(this.min, next);
    if (this.max !== null) next = Math.min(this.max, next);
    next = Number(next.toFixed(10));
    if (next === this.value) return;
    this.value = next;
    this._updateFormValue();
    this.$emit("change", { value: this.value });
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("editing") && this.editing) {
      const input = /** @type {HTMLInputElement | null} */ (this.querySelector(".stepper-edit"));
      if (input) { input.focus(); input.select?.(); }
    }
  },

  _renderStepper() {
    const current = this.value ?? 0;
    const atMin = this.min !== null && current <= this.min;
    const atMax = this.max !== null && current >= this.max;
    return html`
      <div class="stepper-row">
        ${this.label ? html`<span class="stepper-label">${this.label}</span>` : ""}
        <div class="stepper-controls">
          <button
            type="button"
            class="stepper-button"
            aria-label=${lcText("lc-number-input", "lower", { label: this.label })}
            ?disabled=${this.disabled || this.readonly || atMin}
            @click=${this.decrement}
            @pointerdown=${() => this._holdStart(-1)}
            @pointerup=${() => this._holdStop()}
            @pointerleave=${() => this._holdStop()}
            @pointercancel=${() => this._holdStop()}
          >
            <lc-icon name="minus" size="18"></lc-icon>
          </button>
          <span class="stepper-value" role="status">
            ${this.editing
              ? html`<input
                  class="stepper-edit"
                  type="number"
                  inputmode="decimal"
                  style="width:5ch;font:inherit;color:inherit;text-align:center;background:transparent;border:none;outline:none;padding:0"
                  .value=${this.value == null ? "" : String(this.value)}
                  step=${this.step}
                  min=${this.min === null ? nothing : this.min}
                  max=${this.max === null ? nothing : this.max}
                  @keydown=${(e) => { if (e.key === "Enter") e.target.blur(); }}
                  @change=${(e) => this._commitEdit(e.target.value)}
                  @blur=${(e) => this._commitEdit(e.target.value)}
                />`
              : this.display
                ? this.display
                : html`<button
                    type="button"
                    class="stepper-read"
                    style="font:inherit;color:inherit;background:transparent;border:none;padding:0;cursor:text"
                    aria-label=${lcText("lc-number-input", "edit", { label: this.label })}
                    ?disabled=${this.disabled || this.readonly}
                    @click=${() => this._startEdit()}
                  >${this.value}${this.unit ? html`<span class="stepper-unit">${this.unit}</span>` : ""}</button>`}
          </span>
          <button
            type="button"
            class="stepper-button"
            aria-label=${lcText("lc-number-input", "raise", { label: this.label })}
            ?disabled=${this.disabled || this.readonly || atMax}
            @click=${this.increment}
            @pointerdown=${() => this._holdStart(1)}
            @pointerup=${() => this._holdStop()}
            @pointerleave=${() => this._holdStop()}
            @pointercancel=${() => this._holdStop()}
          >
            <lc-icon name="plus" size="18"></lc-icon>
          </button>
        </div>
      </div>
    `;
  },

  render() {
    if (this.stepper) return this._renderStepper();
    return html`
      <div class="number-input-wrapper">
        <input
          type="number"
          class="number-input"
          .value=${this.value == null ? "" : String(this.value)}
          placeholder=${this.placeholder}
          step=${this.step}
          min=${this.min === null ? nothing : this.min}
          max=${this.max === null ? nothing : this.max}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          @input=${this.handleInput.bind(this)}
          @change=${this.handleChange.bind(this)}
        />
        ${
          this.showButtons
            ? html`
              <div class="number-input-buttons">
                <button
                  type="button"
                  class="number-input-button increment"
                  ?disabled=${this.disabled || this.readonly}
                  @click=${this.increment}
                  tabindex="-1"
                >
                  <lc-icon name="chevron-up"></lc-icon>
                </button>
                <button
                  type="button"
                  class="number-input-button decrement"
                  ?disabled=${this.disabled || this.readonly}
                  @click=${this.decrement}
                  tabindex="-1"
                >
                  <lc-icon name="chevron-down"></lc-icon>
                </button>
              </div>
            `
            : ""
        }
      </div>
    `;
  },
});

/**
 * Number Input Component
 *
 * @component
 * @category form
 * @tag lc-number-input
 *
 * Numeric input field with optional increment/decrement buttons.
 *
 * `stepper` swaps the hairline spinner for `label · − reading +`: thumb-sized
 * controls and no keyboard, which is what a phone wants for adjusting a number
 * rather than entering one. `size="lg"` makes the reading lead and the label
 * recede, for the one number a screen is about.
 *
 * @example
 * // Basic number input
 * ```html
 * <lc-number-input value="5"></lc-number-input>
 * ```
 *
 * @example
 * // Stepper: tap to adjust
 * ```html
 * <lc-number-input stepper size="lg" label="Reps" value="8" min="0"></lc-number-input>
 * <lc-number-input stepper label="Weight" unit="kg" value="60" step="2.5" min="0"></lc-number-input>
 * ```
 *
 * @example
 * // A reading the component cannot compose itself
 * ```html
 * <lc-number-input stepper label="Rest" .value=${this.seconds} display=${fmtDuration(this.seconds)}></lc-number-input>
 * ```
 *
 * @example
 * // With min, max, and step
 * ```html
 * <lc-number-input min="0" max="100" step="5" value="50"></lc-number-input>
 * ```
 *
 * @example
 * // Without buttons
 * ```html
 * <lc-number-input value="42" show-buttons="false"></lc-number-input>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-number-input size="xs" value="1"></lc-number-input>
 *   <lc-number-input size="sm" value="2"></lc-number-input>
 *   <lc-number-input size="md" value="3"></lc-number-input>
 *   <lc-number-input size="lg" value="4"></lc-number-input>
 *   <lc-number-input size="xl" value="5"></lc-number-input>
 * </div>
 * ```
 *
 * @example
 * // Decimal values
 * ```html
 * <lc-number-input value="3.14" step="0.01" placeholder="Enter price"></lc-number-input>
 * ```
 *
 * @example
 * // States
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-number-input value="10" placeholder="Normal"></lc-number-input>
 *   <lc-number-input value="10" disabled>Disabled</lc-number-input>
 *   <lc-number-input value="10" readonly>Read only</lc-number-input>
 *   <lc-number-input required placeholder="Required"></lc-number-input>
 * </div>
 * ```
 *
 * @example
 * // With event handling
 * ```js
 * html`<lc-number-input
 *   .value=${this.quantity}
 *   min="1"
 *   max="99"
 *   @change=${(e) => this.quantity = e.detail.value}
 * ></lc-number-input>`
 * ```
 *
 * @example
 * // In a form (quantity selector)
 * ```html
 * <form>
 *   <label>Quantity:
 *     <lc-number-input name="quantity" min="1" max="10" value="1"></lc-number-input>
 *   </label>
 *   <button type="submit">Add to Cart</button>
 * </form>
 * ```
 */
