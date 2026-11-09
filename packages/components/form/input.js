import { html, nothing } from "@lightstart/light/html";
import { defineComponent } from "@lightstart/light";
import { withFormControl } from "@lightstart/components/mixins/form-control.js";
import T from "@lightstart/light/types";

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
        name=${this.name || this.id || nothing}
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
