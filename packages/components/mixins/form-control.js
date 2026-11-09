import T from "@lightstart/light/types";
import { defineMixin } from "@lightstart/light";
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
    _labelledBy: T.string({ reactive: false, defaultValue: "" }),
    _internals: /** @type {Prop<ElementInternals | null>} */ (T.object({ reactive: false, defaultValue: null })),
  },
  events: {
    input: T.object({ value: T.any() }),
    change: T.object({ value: T.any() }),
  },

  /**
   * The id of the inner native control. It is never the host's own id: an
   * outside `<label for>` points at the host, which forwards the activation to
   * this control, so the two elements must not share one id.
   * @returns {string}
   */
  getInputId() {
    if (this.id) return `${this.id}-control`;
    if (!this._inputId) this._inputId = uniqueId(ID_PREFIX);
    return this._inputId;
  },

  connected() {
    if (!this.id && !this._inputId) this._inputId = uniqueId(ID_PREFIX);
    if (this.attachInternals && !this._internals)
      this._internals = this.attachInternals();
    this.addEventListener("click", this._onHostClick);
    this.$own(() => this.removeEventListener("click", this._onHostClick));
    this._syncLabelledBy();
  },

  /**
   * A label outside the host points at the host, and the platform sends its
   * activation here as a click on the host itself. Send it on to the inner
   * control: a checkbox or radio fires its own click so a label toggles it,
   * anything else takes focus.
   * @param {MouseEvent} e
   */
  _onHostClick(e) {
    if (this.disabled || e.target !== this) return;
    const control = /** @type {HTMLElement | null} */ (
      this.querySelector(`#${CSS.escape(this.getInputId())}`)
    );
    if (!control) return;
    if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio"))
      control.click();
    else control.focus();
  },

  updated() {
    this._syncLabelledBy();
  },

  /**
   * Name the inner control from the labels pointing at the host, plus the
   * host's own `label` when it draws one. With none outside, drop the
   * `aria-labelledby` this mixin set and leave one the component set alone.
   */
  _syncLabelledBy() {
    const control = /** @type {HTMLElement | null} */ (
      this.querySelector(`#${CSS.escape(this.getInputId())}`)
    );
    if (!control) return;
    const labels = /** @type {HTMLLabelElement[]} */ ([...(this._internals?.labels ?? [])]);
    if (!labels.length) {
      if (this._labelledBy && control.getAttribute("aria-labelledby") === this._labelledBy)
        control.removeAttribute("aria-labelledby");
      this._labelledBy = "";
      return;
    }
    const own = /** @type {HTMLLabelElement | null} */ (this.querySelector("lc-label > label"));
    if (own) labels.push(own);
    this._labelledBy = labels
      .map((label) => label.id || (label.id = uniqueId("lc-label-")))
      .join(" ");
    control.setAttribute("aria-labelledby", this._labelledBy);
  },

  /** @param {unknown} value */
  syncFormValue(value) {
    if (this._internals?.setFormValue)
      this._internals.setFormValue(value == null ? "" : String(value));
  },
});

export default withFormControl;
