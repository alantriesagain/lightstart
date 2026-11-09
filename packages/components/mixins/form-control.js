import T from "@lightstart/light/types";
import { defineMixin } from "@lightstart/light";
import { uniqueId } from "../utils/id.js";

/** @import { Prop, Renderable } from "../types.ts" */

const ID_PREFIX = "lc-form-";

export const withFormControl = defineMixin({
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
  },
  events: {
    input: T.object({ value: T.any() }),
    change: T.object({ value: T.any() }),
  },

  /**
   * The id of the inner native control, never the host's own: both live in
   * the document, and a shared id sends the control's `<label for>` to the host.
   * @returns {string}
   */
  getInputId() {
    if (this.id) return `${this.id}-control`;
    if (!this._inputId) this._inputId = uniqueId(ID_PREFIX);
    return this._inputId;
  },

  connected() {
    if (!this.id && !this._inputId) this._inputId = uniqueId(ID_PREFIX);
  },
});

export default withFormControl;
