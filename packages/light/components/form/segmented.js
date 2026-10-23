import { html, nothing } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";

/** @import { Prop, SegmentedOption } from "../types.ts" */

export default defineComponent({
  tag: "lc-segmented",
  props: {
    options: /** @type {Prop<(string | SegmentedOption)[]>} */ (T.array({ defaultValue: [] })),
    value: "",
    values: /** @type {Prop<string[]>} */ (T.array({ defaultValue: [] })),
    multiple: false,
    disabled: false,
    size: T.string({ defaultValue: "md", enum: ["sm", "md", "lg"] }),
    block: false,
    name: "",
  },
  style: true,
  events: {
    change: T.object({ value: T.string(), values: T.array() }),
  },

  _options() {
    return this.options.map((o) => (typeof o === "object" ? o : { value: o, label: o }));
  },

  /** @param {string} value */
  _isOn(value) {
    return this.multiple ? (this.values || []).includes(value) : value === this.value;
  },

  /** @param {string} value */
  _pick(value) {
    if (this.disabled) return;
    if (this.multiple) return this._toggle(value);
    if (value === this.value) return;
    this.value = value;
    this.$emit("change", { value });
  },

  /** @param {string} value */
  _toggle(value) {
    const held = new Set(this.values || []);
    if (held.has(value)) held.delete(value);
    else held.add(value);
    const known = this._options().map((option) => option.value);
    const values = [...known.filter((option) => held.has(option)), ...[...held].filter((entry) => !known.includes(entry))];
    this.values = values;
    this.$emit("change", { value, values });
  },

  render() {
    const options = this._options();
    const multiple = this.multiple;
    return html`
      <div class="segmented-track" role=${multiple ? "group" : "radiogroup"} aria-disabled=${this.disabled ? "true" : "false"}>
        ${options.map((option) => {
          const on = this._isOn(option.value);
          return html`
          <button
            type="button"
            role=${multiple ? nothing : "radio"}
            aria-checked=${multiple ? nothing : on ? "true" : "false"}
            aria-pressed=${multiple ? (on ? "true" : "false") : nothing}
            class="segmented-option${on ? " is-selected" : ""}"
            ?disabled=${this.disabled}
            @click=${() => this._pick(option.value)}
            aria-label=${option.icon ? String(option.label ?? option.value) : nothing}
            title=${option.icon ? String(option.label ?? option.value) : nothing}
          >${option.icon ? html`<lc-icon name=${option.icon} size="14"></lc-icon>` : option.label ?? option.value}${option.count ? html`<span class="segmented-count">${option.count}</span>` : nothing}</button>`;
        })}
      </div>`;
  },
});

/**
 * Segmented Component
 *
 * @component
 * @category form
 * @tag lc-segmented
 *
 * Pick one of a few short options. One track holds every segment, so there are
 * no borders between them to double up and every segment is the same shape:
 * which is what `lc-join` around a row of buttons cannot give you, because a
 * button keeps its own radius and outline.
 *
 * `multiple` turns the segments into toggles: `values` holds every option that
 * is on, in the order of the options, and `change` carries the option just
 * toggled as `value` beside the new `values`.
 *
 * @example
 * // Units
 * ```html
 * <lc-segmented .options=${["cm · kg", "ft · lb"]} value="cm · kg"></lc-segmented>
 * ```
 *
 * @example
 * // Separate value and label
 * ```html
 * <lc-segmented
 *   .options=${[{ value: "kg", label: "cm · kg" }, { value: "lb", label: "ft · lb" }]}
 *   value=${this.weightUnit}
 *   @change=${(e) => (this.weightUnit = e.detail.value)}
 * ></lc-segmented>
 * ```
 *
 * @example
 * // Several at once
 * ```html
 * <lc-segmented multiple block
 *   .options=${[{ value: "Monday", label: "Mon" }, { value: "Tuesday", label: "Tue" }]}
 *   .values=${this.days}
 *   @change=${(e) => (this.days = e.detail.values)}
 * ></lc-segmented>
 * ```
 */
