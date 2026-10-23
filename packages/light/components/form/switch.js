import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";

/** @import { Prop } from "../types.ts" */
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
  tag: "lc-switch",
  props: {
    _internals: /** @type {Prop<ElementInternals | null>} */ (T.object({ reactive: false, defaultValue: null })),
    checked: false,
    disabled: false,
    name: "",
    value: "on",
    label: "",
    size: T.string({
      defaultValue: "md",
      enum: ["xs", "sm", "md", "lg", "xl"],
    }),
    variant: T.string({
      defaultValue: "primary",
      enum: ["primary", "secondary", "success", "warning", "error"],
    }),
  },
  style: true,
  formAssociated: true,

  connected() {
    if (!this._internals)
      this._internals = this.attachInternals();

    this._internals.setFormValue(this.checked ? this.value : null);
  },

  /** @param {Event} e */
  handleChange(e) {
    e.stopPropagation();
    this.checked = /** @type {HTMLInputElement} */ (e.target).checked;
    this._internals?.setFormValue(this.checked ? this.value : null);
    this.$emit("change", { checked: this.checked });
    this.$emit("input", { checked: this.checked });
  },

  render() {
    return html`
      <label class="switch-wrapper">
        <input
          type="checkbox"
          class="switch-native"
          .checked=${this.checked}
          ?disabled=${this.disabled}
          name=${this.name}
          value=${this.value}
          @change=${this.handleChange.bind(this)}
        />
        <div class="switch-control">
          <div class="switch-thumb"></div>
        </div>
        ${this.label ? html`<span class="switch-label">${this.label}</span>` : ""}
      </label>
    `;
  },
});

/**
 * Switch Component
 *
 * @component
 * @category form
 * @tag lc-switch
 *
 * A toggle switch for boolean on/off states.
 *
 * @example Basic Switch
 * ```html
 * <lc-switch></lc-switch>
 * ```
 *
 * @example With Label
 * ```html
 * <lc-switch label="Enable notifications" checked></lc-switch>
 * ```
 *
 * @example Size Variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-switch size="xs" label="Extra small"></lc-switch>
 *   <lc-switch size="sm" label="Small"></lc-switch>
 *   <lc-switch size="md" label="Medium"></lc-switch>
 *   <lc-switch size="lg" label="Large"></lc-switch>
 *   <lc-switch size="xl" label="Extra large"></lc-switch>
 * </div>
 * ```
 *
 * @example Color Variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   <lc-switch variant="primary" label="Primary" checked></lc-switch>
 *   <lc-switch variant="secondary" label="Secondary" checked></lc-switch>
 *   <lc-switch variant="success" label="Success" checked></lc-switch>
 *   <lc-switch variant="warning" label="Warning" checked></lc-switch>
 *   <lc-switch variant="error" label="Error" checked></lc-switch>
 * </div>
 * ```
 *
 * @example Disabled State
 * ```html
 * <div style="display: flex; gap: 1rem;">
 *   <lc-switch label="Disabled off" disabled></lc-switch>
 *   <lc-switch label="Disabled on" disabled checked></lc-switch>
 * </div>
 * ```
 *
 * @example With Event Handling
 * ```js
 * html`<lc-switch
 *   label="Dark mode"
 *   @change=${(e) => console.log('Dark mode:', e.detail.checked)}
 * ></lc-switch>`
 * ```
 *
 * @example In a Form
 * ```html
 * <form>
 *   <lc-switch name="newsletter" value="yes" label="Subscribe to newsletter"></lc-switch>
 *   <button type="submit">Submit</button>
 * </form>
 * ```
 */
