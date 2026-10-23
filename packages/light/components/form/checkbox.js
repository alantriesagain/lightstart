import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import T from "@bootstrapp/light/types";

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-checkbox",
  props: {
    checked: false,
    indeterminate: false,
    variant: T.string({
      defaultValue: "primary",
      enum: ["primary", "secondary", "success", "warning", "error"],
    }),
    shape: T.string({ defaultValue: "square", enum: ["square", "round"] }),
  },
  style: true,

  connected() {
    this._updateFormValue();
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("checked"))
      this._updateFormValue();
    if (changedProps.has("indeterminate")) {
      const input = this.querySelector("input");
      if (input) input.indeterminate = this.indeterminate;
    }
  },

  _updateFormValue() {
    this.syncFormValue(this.checked ? (this.value || "on") : null);
  },

  /** @param {Event} e */
  handleChange(e) {
    e.stopPropagation();
    this.checked = /** @type {HTMLInputElement} */ (e.target).checked;
    this.indeterminate = false;
    this._updateFormValue();
    this.$emit("change", { checked: this.checked, value: this.value });
  },

  render() {
    const id = this.getInputId();
    return html`
      <input
        type="checkbox"
        id=${id}
        class="checkbox"
        ?checked=${this.checked}
        .indeterminate=${this.indeterminate}
        value=${this.value}
        name=${this.name}
        ?disabled=${this.disabled}
        ?required=${this.required}
        @change=${this.handleChange.bind(this)}
      />
      ${this.label ? html`<lc-label inline for=${id} text=${this.label} ?required=${this.required}></lc-label>` : ""}
    `;
  },
});

/**
 * Checkbox Component
 *
 * @component
 * @category form
 * @tag lc-checkbox
 *
 * A checkbox input for boolean selections with label support.
 *
 * @example
 * // Basic checkbox
 * ```html
 * <lc-checkbox label="Accept terms and conditions"></lc-checkbox>
 * ```
 *
 * @example
 * // A round state ring: empty, a dot while in progress, a check when done
 * ```html
 * <lc-checkbox shape="round" variant="warning" indeterminate></lc-checkbox>
 * <lc-checkbox shape="round" variant="success" checked></lc-checkbox>
 * ```
 *
 * @example
 * // Checked by default
 * ```html
 * <lc-checkbox checked label="Subscribe to newsletter"></lc-checkbox>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-checkbox size="xs" label="Extra small"></lc-checkbox>
 *   <lc-checkbox size="sm" label="Small"></lc-checkbox>
 *   <lc-checkbox size="md" checked label="Medium"></lc-checkbox>
 *   <lc-checkbox size="lg" label="Large"></lc-checkbox>
 *   <lc-checkbox size="xl" label="Extra large"></lc-checkbox>
 * </div>
 * ```
 *
 * @example
 * // Color variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-checkbox variant="primary" checked label="Primary"></lc-checkbox>
 *   <lc-checkbox variant="secondary" checked label="Secondary"></lc-checkbox>
 *   <lc-checkbox variant="success" checked label="Success"></lc-checkbox>
 *   <lc-checkbox variant="warning" checked label="Warning"></lc-checkbox>
 *   <lc-checkbox variant="error" checked label="Error"></lc-checkbox>
 * </div>
 * ```
 *
 * @example
 * // Indeterminate state
 * ```html
 * <lc-checkbox indeterminate label="Select all"></lc-checkbox>
 * ```
 *
 * @example
 * // Disabled state
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-checkbox disabled label="Disabled unchecked"></lc-checkbox>
 *   <lc-checkbox checked disabled label="Disabled checked"></lc-checkbox>
 * </div>
 * ```
 *
 * @example
 * // With event handling
 * ```js
 * html`<lc-checkbox
 *   ?checked=${this.agreed}
 *   @change=${(e) => this.agreed = e.detail.checked}
 *   label="I agree to the terms"
 * ></lc-checkbox>`
 * ```
 *
 * @example
 * // In a form
 * ```html
 * <form>
 *   <lc-checkbox name="newsletter" value="yes" label="Subscribe to newsletter"></lc-checkbox>
 *   <lc-checkbox name="terms" value="accepted" required label="Accept terms"></lc-checkbox>
 *   <button type="submit">Submit</button>
 * </form>
 * ```
 */
