import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import T from "@bootstrapp/light/types";

/** @import { RadioElement } from "../types.ts" */

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-radio",
  props: {
    checked: false,
    variant: T.string({
      defaultValue: "primary",
      enum: ["primary", "secondary", "success", "warning", "error"],
    }),
  },
  style: true,

  /** @param {Event} e */
  handleChange(e) {
    this.checked = /** @type {HTMLInputElement} */ (e.target).checked;
    this.$emit("change", { checked: this.checked, value: this.value });

    if (this.checked && this.name) {
      const scope = this.closest("lc-radio-group, form") ?? this.getRootNode();
      /** @type {NodeListOf<RadioElement>} */
      const radios = /** @type {ParentNode} */ (scope).querySelectorAll(`lc-radio[name="${this.name}"]`);
      for (const radio of radios)
        if (radio !== this && radio.checked) radio.checked = false;
    }
  },

  render() {
    return html`
      <label class="radio-wrapper">
        <input
          type="radio"
          class="radio"
          .checked=${this.checked}
          .value=${this.value}
          name=${this.name}
          ?disabled=${this.disabled}
          ?required=${this.required}
          @change=${this.handleChange.bind(this)}
        />
        ${this.label ? html`<span class="radio-label">${this.label}</span>` : ""}
      </label>
    `;
  },
});

/**
 * Radio Component
 *
 * @component
 * @category form
 * @tag lc-radio
 *
 * A radio button input for selecting one option from a group.
 *
 * @example
 * // Basic radio group
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-radio name="option" value="1" checked>Option 1</lc-radio>
 *   <lc-radio name="option" value="2">Option 2</lc-radio>
 *   <lc-radio name="option" value="3">Option 3</lc-radio>
 * </div>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-radio size="xs" name="size1" value="xs" checked>Extra small</lc-radio>
 *   <lc-radio size="sm" name="size2" value="sm" checked>Small</lc-radio>
 *   <lc-radio size="md" name="size3" value="md" checked>Medium</lc-radio>
 *   <lc-radio size="lg" name="size4" value="lg" checked>Large</lc-radio>
 *   <lc-radio size="xl" name="size5" value="xl" checked>Extra large</lc-radio>
 * </div>
 * ```
 *
 * @example
 * // Color variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-radio variant="primary" name="color1" checked>Primary</lc-radio>
 *   <lc-radio variant="secondary" name="color2" checked>Secondary</lc-radio>
 *   <lc-radio variant="success" name="color3" checked>Success</lc-radio>
 *   <lc-radio variant="warning" name="color4" checked>Warning</lc-radio>
 *   <lc-radio variant="error" name="color5" checked>Error</lc-radio>
 * </div>
 * ```
 *
 * @example
 * // Disabled state
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-radio name="disabled" value="1" disabled>Disabled unchecked</lc-radio>
 *   <lc-radio name="disabled" value="2" checked disabled>Disabled checked</lc-radio>
 * </div>
 * ```
 *
 * @example
 * // With event handling
 * ```js
 * html`
 *   <lc-radio
 *     name="payment"
 *     value="credit"
 *     @change=${(e) => this.paymentMethod = e.detail.value}
 *   >Credit Card</lc-radio>
 *   <lc-radio
 *     name="payment"
 *     value="paypal"
 *     @change=${(e) => this.paymentMethod = e.detail.value}
 *   >PayPal</lc-radio>
 * `
 * ```
 *
 * @example
 * // In a form
 * ```html
 * <form>
 *   <fieldset>
 *     <legend>Choose your plan:</legend>
 *     <lc-radio name="plan" value="basic" required>Basic - $9/mo</lc-radio>
 *     <lc-radio name="plan" value="pro">Pro - $29/mo</lc-radio>
 *     <lc-radio name="plan" value="enterprise">Enterprise - $99/mo</lc-radio>
 *   </fieldset>
 *   <button type="submit">Continue</button>
 * </form>
 * ```
 */
