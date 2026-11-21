import { html, nothing } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { uniqueId } from "../utils/id.js";

/** @import { Prop } from "../types.ts" */

export default defineComponent({
  tag: "lc-setting-row",
  style: true,
  props: {
    label: "",
    description: "",
    icon: "",
    _labelId: T.string({ reactive: false, attribute: false, defaultValue: "" }),
    _descriptionId: T.string({ reactive: false, attribute: false, defaultValue: "" }),
  },

  connected() {
    this._ensureIds();
  },

  firstUpdated() {
    this._syncAria();
  },

  /** @param {{ changedProps: Map<string, unknown> }} arg */
  updated({ changedProps }) {
    if (changedProps.has("label") || changedProps.has("description")) this._syncAria();
  },

  _ensureIds() {
    if (!this._labelId) this._labelId = uniqueId("lc-setting-row-label-");
    if (!this._descriptionId) this._descriptionId = uniqueId("lc-setting-row-description-");
  },

  _hasDescription() {
    if (this.description || this.querySelector(':scope > [slot="description"]')) return true;
    const slot = this.querySelector('slot[name="description"]');
    return slot instanceof HTMLElement && slot.childElementCount > 0;
  },

  /** @returns {HTMLSlotElement | null} */
  _controlSlot() {
    const slot = this.querySelector("slot[data-control-slot]");
    return slot instanceof HTMLSlotElement ? slot : null;
  },

  /** @returns {HTMLElement | null} */
  _control() {
    const first = this._controlSlot()?.firstElementChild;
    return first instanceof HTMLElement ? first : null;
  },

  _syncAria() {
    this._ensureIds();
    const labelId = this._labelId;
    const descriptionId = this._descriptionId;
    const hasDescription = this._hasDescription();
    for (const control of this._controlSlot()?.children ?? []) {
      if (!(control instanceof HTMLElement)) continue;
      control.setAttribute("aria-labelledby", labelId);
      if (hasDescription) control.setAttribute("aria-describedby", descriptionId);
      else control.removeAttribute("aria-describedby");
    }
  },

  /** @param {MouseEvent} e */
  _labelClick(e) {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("a, button, input, select, textarea")) return;
    e.preventDefault();
    const control = this._control();
    if (!control) return;
    if (control.localName === "lc-switch" || control.localName === "lc-checkbox") {
      const input = control.querySelector("input");
      if (input instanceof HTMLElement) {
        input.click();
        return;
      }
    }
    const focusable = control.matches("input, select, textarea, button, a")
      ? control
      : control.querySelector("input, select, textarea, button, a");
    if (focusable instanceof HTMLElement) focusable.focus();
  },

  render() {
    this._ensureIds();
    return html`
      <div part="lc-setting-row-row" class="setting-row">
        ${this.icon ? html`<lc-icon part="lc-setting-row-icon" class="setting-row-icon" name=${this.icon} size="18"></lc-icon>` : nothing}
        <span part="lc-setting-row-text" class="setting-row-text">
          <label part="lc-setting-row-label" class="setting-row-label" id=${this._labelId} @click=${this._labelClick}>
            <slot name="label">${this.label}</slot>
          </label>
          ${this._hasDescription()
            ? html`
                <span part="lc-setting-row-description" class="setting-row-description" id=${this._descriptionId}>
                  <slot name="description" @slotchange=${this._syncAria}>${this.description}</slot>
                </span>
              `
            : nothing}
        </span>
        <span part="lc-setting-row-control" class="setting-row-control">
          <slot data-control-slot @slotchange=${this._syncAria}></slot>
        </span>
      </div>
    `;
  },
});

/**
 * Setting Row Component
 *
 * @component
 * @category layout
 * @tag lc-setting-row
 *
 * One line of a settings page: an optional icon, a label with a description
 * under it, and the control at the end. The default slot takes the control
 * (`lc-switch`, `lc-select`, a button); `label` and `description` slots take
 * rich text instead of the props. The row points the control's
 * `aria-labelledby` and `aria-describedby` at its own text, and a click on the
 * label toggles a slotted switch or checkbox and focuses anything else. On a
 * narrow container the control drops under the text.
 *
 * @slot - The control at the end of the row
 * @slot label - Rich content in place of `label`
 * @slot description - Rich content in place of `description`
 *
 * @example
 * ```html
 * <lc-setting-row icon="bell" label="Notifications" description="Mentions and replies">
 *   <lc-switch checked></lc-switch>
 * </lc-setting-row>
 * ```
 */
