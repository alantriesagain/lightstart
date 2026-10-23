import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import T from "@bootstrapp/light/types";

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-textarea",
  props: {
    rows: 4,
    cols: 50,
    maxlength: T.number({ defaultValue: null }),
    minlength: T.number({ defaultValue: null }),
    resize: T.string({
      defaultValue: "vertical",
      enum: ["none", "both", "horizontal", "vertical"],
    }),
  },
  style: true,

  connected() {
    this.syncFormValue(this.value);
  },

  /** @param {Event} e */
  handleInput(e) {
    e.stopPropagation();
    this.value = /** @type {HTMLTextAreaElement} */ (e.target).value;
    this.syncFormValue(this.value);
    this.$emit("input", { value: this.value });
  },

  /** @param {Event} e */
  handleChange(e) {
    e.stopPropagation();
    this.value = /** @type {HTMLTextAreaElement} */ (e.target).value;
    this.syncFormValue(this.value);
    this.$emit("change", { value: this.value });
  },

  render() {
    const id = this.getInputId();
    return html`
      ${this.label ? html`<lc-label for=${id} text=${this.label} ?required=${this.required}></lc-label>` : ""}
      <textarea
        id=${id}
        class="textarea"
        name=${this.name}
        .value=${this.value ?? ""}
        placeholder=${this.placeholder}
        rows=${this.rows}
        ?disabled=${this.disabled}
        ?readonly=${this.readonly}
        ?required=${this.required}
        @input=${this.handleInput.bind(this)}
        @change=${this.handleChange.bind(this)}
      ></textarea>
    `;
  },
});

/**
 * Textarea Component
 *
 * @component
 * @category form
 * @tag lc-textarea
 *
 * Multi-line text input field with size variants and resize options.
 *
 * @example
 * // Basic textarea
 * ```html
 * <lc-textarea placeholder="Enter your message..."></lc-textarea>
 * ```
 *
 * @example
 * // With custom rows
 * ```html
 * <lc-textarea rows="8" placeholder="Long message..."></lc-textarea>
 * ```
 *
 * @example
 * // Size variants
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-textarea size="xs" placeholder="Extra small" rows="2"></lc-textarea>
 *   <lc-textarea size="sm" placeholder="Small" rows="3"></lc-textarea>
 *   <lc-textarea size="md" placeholder="Medium" rows="4"></lc-textarea>
 *   <lc-textarea size="lg" placeholder="Large" rows="5"></lc-textarea>
 *   <lc-textarea size="xl" placeholder="Extra large" rows="6"></lc-textarea>
 * </div>
 * ```
 *
 * @example
 * // Resize options
 * ```html
 * <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
 *   <lc-textarea resize="none" placeholder="No resize"></lc-textarea>
 *   <lc-textarea resize="vertical" placeholder="Vertical resize"></lc-textarea>
 *   <lc-textarea resize="horizontal" placeholder="Horizontal resize"></lc-textarea>
 *   <lc-textarea resize="both" placeholder="Both resize"></lc-textarea>
 * </div>
 * ```
 *
 * @example
 * // With character limit
 * ```html
 * <lc-textarea maxlength="200" placeholder="Max 200 characters"></lc-textarea>
 * ```
 *
 * @example
 * // States
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-textarea placeholder="Normal"></lc-textarea>
 *   <lc-textarea placeholder="Disabled" disabled></lc-textarea>
 *   <lc-textarea placeholder="Readonly" value="Read only text" readonly></lc-textarea>
 *   <lc-textarea placeholder="Required" required></lc-textarea>
 * </div>
 * ```
 *
 * @example
 * // With binding
 * ```js
 * html`<lc-textarea
 *   .value=${this.message}
 *   @input=${(e) => this.message = e.detail.value}
 *   placeholder="Type your message..."
 * ></lc-textarea>`
 * ```
 */
