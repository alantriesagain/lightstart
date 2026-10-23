import T from "@bootstrapp/light/types";
import { defineMixin } from "@bootstrapp/light";
import { uniqueId } from "../utils/id.js";

/** @import { Prop, Renderable } from "../types.ts" */

const ID_PREFIX = "lc-form-";

export const withFormControl = defineMixin({
  formAssociated: true,
  props: {
    label: T.string(),
    name: T.string(),
    id: T.string(),
    value: /** @type {Prop<Renderable>} */ (T.any("")),
    placeholder: "",
    disabled: false,
    readonly: false,
    required: false,
    error: false,
    fullWidth: false,
    size: T.string({
      defaultValue: "md",
      enum: ["xs", "sm", "md", "lg", "xl"],
    }),
    variant: T.string({
      defaultValue: "default",
      enum: ["default", "primary", "secondary", "success", "warning", "error"],
    }),
    _inputId: T.string({ reactive: false, defaultValue: "" }),
    _internals: /** @type {Prop<ElementInternals | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },
  events: {
    input: T.object({ value: T.any() }),
    change: T.object({ value: T.any() }),
  },

  getInputId() {
    if (this.id) return this.id;
    if (!this._inputId) this._inputId = uniqueId(ID_PREFIX);
    return this._inputId;
  },

  connected() {
    if (!this.id && !this._inputId) this._inputId = uniqueId(ID_PREFIX);
    if (this.attachInternals && !this._internals)
      this._internals = this.attachInternals();
  },

  /** @param {unknown} value */
  syncFormValue(value) {
    if (this._internals?.setFormValue)
      this._internals.setFormValue(value == null ? "" : String(value));
  },
});

export default withFormControl;
