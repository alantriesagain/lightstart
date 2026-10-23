import { html, nothing } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import T from "@bootstrapp/light/types";

/** @import { Prop } from "../types.ts" */

export default defineComponent({
  mixins: [withFormControl],
  tag: "lc-input",
  props: {
    type: T.string({
      defaultValue: "text",
      enum: ["text", "email", "tel", "url", "search", "password", "number", "date", "datetime-local", "time", "month", "week", "color"],
    }),
    inputmode: T.string(),
    min: /** @type {Prop<string | number | null>} */ (T.any({ defaultValue: null })),
    max: /** @type {Prop<string | number | null>} */ (T.any({ defaultValue: null })),
    step: /** @type {Prop<string | number | null>} */ (T.any({ defaultValue: null })),
    prefix: "",
  },
  style: true,

  /** @param {Event} e */
  handleInput(e) {
    e.stopPropagation();
    this.value = /** @type {HTMLInputElement} */ (e.target).value;
    this.$emit("input", { value: this.value });
  },

  /** @param {Event} e */
  handleChange(e) {
    e.stopPropagation();
    this.value = /** @type {HTMLInputElement} */ (e.target).value;
    this.$emit("change", { value: this.value });
  },

  render() {
    const id = this.getInputId();
    const field = html`<input
        id=${id}
        name=${this.name ?? id}
        class="input"
        type=${this.type}
        inputmode=${this.inputmode || nothing}
        .value=${this.value ?? ""}
        placeholder=${this.placeholder}
        min=${this.min ?? nothing}
        max=${this.max ?? nothing}
        step=${this.step ?? nothing}
        ?disabled=${this.disabled}
        ?readonly=${this.readonly}
        ?required=${this.required}
        @input=${this.handleInput.bind(this)}
        @change=${this.handleChange.bind(this)}
      />`;
    return html`
      ${this.label ? html`<lc-label for=${id} text=${this.label} ?required=${this.required}></lc-label>` : ""}
      ${this.prefix
        ? html`<span class="input-affixed" style=${`--lc-input-prefix-chars:${[...this.prefix].length}`}><span class="input-prefix" aria-hidden="true">${this.prefix}</span>${field}</span>`
        : field}
    `;
  },
});

/**
 * Input Component
 *
 * @component
 * @category form
 * @tag lc-input
 *
 * Text input field with size variants matching button sizes for use in lc-join
 *
 * `prefix` is text drawn inside the field before what is typed, and never
 * part of the value: `@` before a handle, `R$` before an amount.
 *
 * @example
 * // Basic input
 * ```html
 * <lc-input placeholder="Enter text..."></lc-input>
 * ```
 *
 * @example
 * // With sizes
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-input size="xs" placeholder="Extra small"></lc-input>
 *   <lc-input size="sm" placeholder="Small"></lc-input>
 *   <lc-input size="md" placeholder="Medium"></lc-input>
 *   <lc-input size="lg" placeholder="Large"></lc-input>
 *   <lc-input size="xl" placeholder="Extra large"></lc-input>
 * </div>
 * ```
 *
 * @example
 * // Different input types
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-input type="text" placeholder="Text"></lc-input>
 *   <lc-input type="email" placeholder="Email"></lc-input>
 *   <lc-input type="tel" placeholder="Phone"></lc-input>
 *   <lc-input type="url" placeholder="URL"></lc-input>
 *   <lc-input type="search" placeholder="Search"></lc-input>
 *   <lc-input type="password" placeholder="Password"></lc-input>
 * </div>
 * ```
 *
 * @example
 * // In button group with lc-join
 * ```html
 * <lc-join>
 *   <lc-input placeholder="Search..." size="md"></lc-input>
 *   <lc-button variant="primary" size="md">Search</lc-button>
 * </lc-join>
 * ```
 *
 * @example
 * // With binding
 * ```js
 * html`<lc-input
 *   .value=${this.searchQuery}
 *   @input=${(e) => this.searchQuery = e.detail.value}
 *   placeholder="Search..."
 * ></lc-input>`
 * ```
 *
 * @example
 * // States
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-input placeholder="Normal"></lc-input>
 *   <lc-input placeholder="Disabled" disabled></lc-input>
 *   <lc-input placeholder="Readonly" value="Read only text" readonly></lc-input>
 *   <lc-input placeholder="Required" required></lc-input>
 * </div>
 * ```
 */
