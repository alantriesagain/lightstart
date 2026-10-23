import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
export default defineComponent({
  tag: "lc-editable",
  props: {
    isEditing: false,
    value: T.string(),
    editingValue: T.string(),
    onSave: T.function(),
    size: T.string({ defaultValue: "lg", enum: ["sm", "md", "lg"] }),
  },
  _textClass() {
    return this.size === "sm" ? "text-sm font-medium" : this.size === "md" ? "text-base font-semibold" : "text-xl font-semibold";
  },

  connected() {
    this.editingValue = this.value;
  },

  startEditing() {
    this.isEditing = true;
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("isEditing") && this.isEditing)
      this.querySelector("input")?.focus();
  },

  cancelEditing() {
    this.editingValue = this.value;
    this.isEditing = false;
  },

  async save() {
    if (this.onSave && typeof this.onSave === "function")

      await this.onSave(this.editingValue);

    this.value = this.editingValue;
    this.isEditing = false;
  },

  render() {
    if (this.isEditing)

      return html`
                <lc-join>
                    <lc-input
                        class=${this._textClass()}
                        .value=${this.editingValue}
                        @input=${(/** @type {CustomEvent<{ value: string }>} */ e) => this.editingValue = e.detail.value}
                        @keydown=${(e) => e.key === "Enter" && this.save()}
                        @blur=${() => this.cancelEditing()}
                    ></lc-input>
                    <lc-button
                        icon="check"
                        class="is-success"
                        @click=${(e) => {
                          e.stopPropagation();
                          this.save();
                        }}
                    ></lc-button>
                    <lc-button
                        icon="x"
                        class="is-danger"
                        @click=${(e) => {
                          e.stopPropagation();
                          this.cancelEditing();
                        }}
                    ></lc-button>
                </lc-join>
            `;

    return html`
                <span
                    class="cursor-text ${this._textClass()} p-1 -m-1 rounded hover:bg-hover cursor-pointer"
                    @click=${this.startEditing.bind(this)}
                >
                    ${this.value}
                </span>
            `;
  },
});
