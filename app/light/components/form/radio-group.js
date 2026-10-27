import { html } from "/app/light/html/index.js";
import { defineComponent } from "/app/light/view/index.js";
import { withFormControl } from "/app/light/components/mixins/form-control.js";
import T from "/app/light/types/types.js";

/** @import { Prop, RadioElement, Renderable } from "../types.js" */

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-radio-group",
  props: {
    orientation: T.string({
      defaultValue: "vertical",
      enum: ["vertical", "horizontal"],
    }),
    variant: T.string({
      defaultValue: "primary",
      enum: ["primary", "secondary", "success", "warning", "error"],
    }),
    _onRadioChange: /** @type {Prop<EventListener | null>} */ (
      T.object({ reactive: false, defaultValue: null })
    ),
  },
  style: true,

  connected() {
    this._onRadioChange = /** @type {EventListener} */ ((e) => {
      const detail = /** @type {CustomEvent<{ checked: boolean, value: Exclude<Renderable, undefined> } | undefined>} */ (e).detail;
      if (!detail?.checked) return;
      this.value = detail.value;
      this._updateFormValue();
      this.$emit("change", { value: this.value });
    });
    this.$own(() => {
      for (const radio of this._radios())
        /** @type {EventTarget} */ (radio).removeEventListener("change", /** @type {EventListener} */ (this._onRadioChange));
    });
    this._updateFormValue();
    this._syncRadios();
  },

  _radios() {
    return [.../** @type {NodeListOf<RadioElement>} */ (this.querySelectorAll("lc-radio"))];
  },

  /** @param {{ changedProps: Map<string, unknown> }} props */
  updated({ changedProps }) {
    if (changedProps.has("value") || changedProps.has("name")) {
      this._syncRadios();
      this._updateFormValue();
    }
    if (
      changedProps.has("size") ||
      changedProps.has("variant") ||
      changedProps.has("disabled")
    )
      this._syncRadios();
  },

  _updateFormValue() {
    this.syncFormValue(this.value || null);
  },

  _syncRadios() {
    for (const radio of this._radios()) {
      const target = /** @type {EventTarget} */ (radio);
      if (this._onRadioChange) {
        target.removeEventListener("change", this._onRadioChange);
        target.addEventListener("change", this._onRadioChange);
      }
      if (this.name) radio.name = this.name;
      if (this.size) radio.size = this.size;
      if (this.variant) radio.variant = this.variant;
      radio.disabled = this.disabled || radio.hasAttribute("disabled");
      radio.checked = radio.value === this.value;
    }
  },

  handleSlotChange() {
    this._syncRadios();
  },

  render() {
    return html`
      <div part="lc-radio-group-container" class="radio-group" role="radiogroup">
        <slot @slotchange=${this.handleSlotChange}></slot>
      </div>
    `;
  },
});

/**
 * Radio Group Component
 *
 * @component
 * @category form
 * @tag lc-radio-group
 *
 * A container for radio buttons that manages the selection state.
 *
 * @example
 * // Basic radio group
 * ```html
 * <lc-radio-group name="plan" value="basic">
 *   <lc-radio value="basic">Basic - $9/mo</lc-radio>
 *   <lc-radio value="pro">Pro - $29/mo</lc-radio>
 *   <lc-radio value="enterprise">Enterprise - $99/mo</lc-radio>
 * </lc-radio-group>
 * ```
 *
 * @example
 * // Horizontal orientation
 * ```html
 * <lc-radio-group name="theme" orientation="horizontal" value="dark">
 *   <lc-radio value="light">Light</lc-radio>
 *   <lc-radio value="dark">Dark</lc-radio>
 *   <lc-radio value="auto">Auto</lc-radio>
 * </lc-radio-group>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-radio-group name="size1" size="xs" value="a">
 *     <lc-radio value="a">Option A</lc-radio>
 *     <lc-radio value="b">Option B</lc-radio>
 *   </lc-radio-group>
 *
 *   <lc-radio-group name="size2" size="lg" value="a">
 *     <lc-radio value="a">Option A</lc-radio>
 *     <lc-radio value="b">Option B</lc-radio>
 *   </lc-radio-group>
 * </div>
 * ```
 *
 * @example
 * // Color variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-radio-group name="variant1" variant="primary" value="yes">
 *     <lc-radio value="yes">Yes</lc-radio>
 *     <lc-radio value="no">No</lc-radio>
 *   </lc-radio-group>
 *
 *   <lc-radio-group name="variant2" variant="success" value="yes">
 *     <lc-radio value="yes">Yes</lc-radio>
 *     <lc-radio value="no">No</lc-radio>
 *   </lc-radio-group>
 * </div>
 * ```
 *
 * @example
 * // Disabled group
 * ```html
 * <lc-radio-group name="disabled" disabled value="option1">
 *   <lc-radio value="option1">Option 1</lc-radio>
 *   <lc-radio value="option2">Option 2</lc-radio>
 *   <lc-radio value="option3">Option 3</lc-radio>
 * </lc-radio-group>
 * ```
 *
 * @example
 * // With event handling
 * ```js
 * html`<lc-radio-group
 *   name="preference"
 *   .value=${this.userPreference}
 *   @change=${(e) => this.userPreference = e.detail.value}
 * >
 *   <lc-radio value="email">Email notifications</lc-radio>
 *   <lc-radio value="sms">SMS notifications</lc-radio>
 *   <lc-radio value="none">No notifications</lc-radio>
 * </lc-radio-group>`
 * ```
 *
 * @example
 * // In a form
 * ```html
 * <form>
 *   <label>Select your subscription:</label>
 *   <lc-radio-group name="subscription" required>
 *     <lc-radio value="monthly">Monthly</lc-radio>
 *     <lc-radio value="yearly">Yearly (Save 20%)</lc-radio>
 *   </lc-radio-group>
 *   <button type="submit">Continue</button>
 * </form>
 * ```
 */
