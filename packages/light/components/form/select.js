import { html, nothing } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";
import { nextIndex } from "../utils/roving.js";
import { withClickOutside } from "@bootstrapp/light/components/mixins/click-outside.js";
import T from "@bootstrapp/light/types";
import { lcText } from "../utils/text.js";

/** @import { Prop, SelectOption } from "../types.ts" */

export default defineComponent({
  mixins: [withFormControl, withClickOutside()],
  tag: "lc-select",
  style: true,
  props: {
    _defaultValue: /** @type {Prop<string | string[]>} */ (T.any({ reactive: false, defaultValue: "" })),
    options: /** @type {Prop<SelectOption[]>} */ (T.array({ defaultValue: [] })),
    multiple: T.boolean(),
    searchable: T.boolean(),
    max: 0,
    open: T.boolean({ attribute: false }),
    search: T.string({ attribute: false, defaultValue: "" }),
    highlightIndex: T.number({ attribute: false, defaultValue: -1 }),
  },
  formResetCallback() {
    if (this.multiple) {
      this.value = Array.isArray(this._defaultValue) ? [...this._defaultValue] : [];
      return;
    }
    const $select = this.querySelector("select");
    if ($select) {
      $select.value = /** @type {string} */ (this._defaultValue) || "";
      this.value = $select.value;
    }
  },
  /** @param {boolean} disabled */
  formDisabledCallback(disabled) {
    const $select = this.querySelector("select");
    if ($select) $select.disabled = disabled;
  },
  /** @param {string} state */
  formStateRestoreCallback(state) {
    if (this.multiple) {
      this.value = state ? state.split(",") : [];
      return;
    }
    const $select = this.querySelector("select");
    if ($select) $select.value = state;
    this.value = state;
  },
  reportValidity() {
    const $select = this.querySelector("select");
    if (!$select) return true;
    const validity = $select.reportValidity() !== false;
    $select?.classList.toggle("input-error", !validity);
    return validity;
  },
  connected() {
    this._defaultValue = this.multiple ? [...this.selected] : String(this.value ?? "");
  },

  /**
   * The current value as the list it is when `multiple`, so every read has
   * one shape whichever mode the element is in.
   * @returns {string[]}
   */
  get selected() {
    if (Array.isArray(this.value)) return /** @type {string[]} */ (this.value);
    return this.value === "" || this.value == null ? [] : [String(this.value)];
  },

  /** @param {unknown} value @returns {boolean} */
  isSelected(value) {
    return this.multiple ? this.selected.includes(String(value)) : value === this.value;
  },

  /**
   * A multi-select's form value is the list joined, which is what
   * `formStateRestoreCallback` reads back.
   * @param {string[] | string} value
   */
  _commit(value) {
    this.value = value;
    this.syncFormValue(Array.isArray(value) ? value.join(",") : value);
    this.$emit("input", { value: this.value });
    this.$emit("change", { value: this.value });
  },

  /**
   * An open list is scrolled into view, clear of whatever the page keeps over
   * its bottom edge (`--lc-select-dropdown-scroll-margin`, a bar or a dock).
   * @param {{ changedProps: Map<string, unknown> }} detail
   */
  updated({ changedProps }) {
    if (!changedProps.has("open") || !this.open) return;
    /** @type {HTMLElement | null} */ (this.querySelector(".select-dropdown"))?.scrollIntoView?.({ block: "nearest" });
  },

  onClickOutside() {
    if (!this.open) return;
    this.open = false;
    this.search = "";
  },

  /** @returns {string} */
  get selectId() {
    return this.getInputId();
  },

  /**
   * @param {SelectOption} option
   * @returns {string}
   */
  _getLabel(option) {
    const label = option?.label ?? option;
    return label == null ? "" : String(label);
  },

  /** @param {SelectOption} option */
  _getValue(option) {
    return option?.value ?? option;
  },

  /**
   * What an option carries before its label, a flag or an emoji, or "".
   * @param {SelectOption | undefined} option
   */
  _getLeading(option) {
    const leading = option && typeof option === "object" ? option.leading : "";
    return typeof leading === "string" ? leading : "";
  },

  /** @param {string} value */
  _optionOf(value) {
    return this.options.find((o) => String(this._getValue(o)) === value);
  },

  _getSelectedLabel() {
    if (this.multiple)
      return this.selected
        .map((value) => {
          const option = this._optionOf(value);
          return option ? this._getLabel(option) : value;
        })
        .join(", ");
    if (!this.value) return "";
    const opt = this.options.find((o) => this._getValue(o) === this.value);
    if (!opt) return this.value;
    const leading = this._getLeading(opt);
    return leading ? `${leading} ${this._getLabel(opt)}` : this._getLabel(opt);
  },

  _getFilteredOptions() {
    if (!this.search) return this.options;
    const q = this.search.trim().toLowerCase();
    if (!q) return this.options;
    /** @type {SelectOption[]} */
    const starts = [];
    /** @type {SelectOption[]} */
    const contains = [];
    for (const option of this.options) {
      const label = this._getLabel(option).toLowerCase();
      if (label.startsWith(q) || label.split(/[\s(/-]+/).some((word) => word.startsWith(q))) starts.push(option);
      else if (label.includes(q)) contains.push(option);
    }
    return [...starts, ...contains];
  },

  _full() {
    return this.multiple && this.max > 0 && this.selected.length >= this.max;
  },

  /** @param {string} value */
  _remove(value) {
    this._commit(this.selected.filter((v) => v !== value));
  },

  /** @param {InputEvent} e */
  _onSearchInput(e) {
    e.stopPropagation();
    this.search = /** @type {HTMLInputElement} */ (e.target).value;
    this.highlightIndex = 0;
    if (!this.open) this.open = true;
    if (!this.search && !this.value)
      this.open = false;

  },

  _onSearchFocus() {
    this.open = true;
    this.search = "";
  },

  /** @param {KeyboardEvent} e */
  _onSearchKeydown(e) {
    const filtered = this._getFilteredOptions();
    if (e.key === "Backspace" && this.multiple && !this.search && this.selected.length) {
      e.preventDefault();
      this._remove(this.selected[this.selected.length - 1]);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const moved = nextIndex(e.key, this.highlightIndex, filtered.length);
      if (moved !== null) this.highlightIndex = moved;
    } else if (
      e.key === "Enter" &&
      this.highlightIndex >= 0 &&
      filtered[this.highlightIndex]
    ) {
      e.preventDefault();
      this._selectOption(filtered[this.highlightIndex]);
    } else if (e.key === "Escape") {
      this.open = false;
      this.search = "";
    }
  },

  /** @param {SelectOption} option */
  _selectOption(option) {
    const value = String(this._getValue(option));
    if (this.multiple) {
      const selected = this.selected;
      if (!selected.includes(value) && this._full()) return;
      this._commit(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
      this.search = "";
      this.highlightIndex = 0;
      this.open = false;
      return;
    }
    this.open = false;
    this.search = "";
    this._commit(/** @type {string} */ (this._getValue(option)));
  },

  /** @param {Event} e @returns {string[] | string} */
  _readNative(e) {
    const $select = /** @type {HTMLSelectElement} */ (e.target);
    return this.multiple ? [...$select.selectedOptions].map((option) => option.value) : $select.value;
  },

  /** @param {Event} e */
  _onInput(e) {
    e.stopPropagation();
    const value = this._readNative(e);
    this.value = value;
    this.syncFormValue(Array.isArray(value) ? value.join(",") : value);
    this.$emit("input", { value: this.value });
  },

  /** @param {Event} e */
  _onChange(e) {
    e.stopPropagation();
    const value = this._readNative(e);
    this.value = value;
    this.syncFormValue(Array.isArray(value) ? value.join(",") : value);
    this.$emit("change", { value: this.value });
  },

  /** @param {MouseEvent} e */
  _toggleDropdown(e) {
    e.preventDefault();
    e.stopPropagation();
    if (this.open) {
      this.open = false;
      this.search = "";
    } else {
      this.open = true;
      this.search = "";
      const input = /** @type {HTMLElement | null} */ (this.querySelector(".select-search-input"));
      if (input) input.focus();
    }
  },

  renderTags() {
    const { disabled, required, placeholder, label } = this;
    const id = this.selectId;
    const selected = this.selected;
    const full = this._full();
    const filtered = this._getFilteredOptions();
    return html`
      ${label ? html`<div class="select-label-row"><lc-label for=${id} text=${label} ?required=${required}></lc-label>${this.max > 0 ? html`<span class="select-count">${lcText("lc-select", "count", { count: selected.length, max: this.max })}</span>` : ""}</div>` : ""}
      <div class="select-wrapper select-tags" @mousedown=${(/** @type {MouseEvent} */ e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          /** @type {HTMLElement | null} */ (this.querySelector(".select-tags-input"))?.focus();
        }
      }}>
        ${selected.map((value) => {
          const option = this._optionOf(value);
          const leading = this._getLeading(option);
          return html`<lc-tag closable size="sm" class="select-tag" data-value=${value} ?disabled=${disabled}
            @close=${(/** @type {Event} */ e) => { e.stopPropagation(); this._remove(value); }}>${leading ? html`<span slot="icon" class="select-leading">${leading}</span>` : ""}${option ? this._getLabel(option) : value}</lc-tag>`;
        })}
        ${full ? "" : html`<input
          type="text"
          id=${id}
          .value=${this.search}
          ?disabled=${disabled}
          placeholder=${placeholder || lcText("lc-select", "add")}
          autocomplete="off"
          @focus=${this._onSearchFocus}
          @input=${this._onSearchInput}
          @change=${(/** @type {Event} */ e) => e.stopPropagation()}
          @keydown=${this._onSearchKeydown}
          class="select-search-input select-tags-input"
        />`}
        ${this.open && !full ? html`
          <div class="select-dropdown" role="listbox">
            ${filtered.length === 0
              ? html`<div class="select-option select-no-results">${lcText("lc-select", "noResults")}</div>`
              : filtered.map((option, i) => {
                const leading = this._getLeading(option);
                return html`<div
                  role="option"
                  data-value=${String(this._getValue(option))}
                  aria-selected=${this.isSelected(this._getValue(option)) ? "true" : "false"}
                  class="select-option ${i === this.highlightIndex ? "highlighted" : ""} ${this.isSelected(this._getValue(option)) ? "selected" : ""}"
                  @mousedown=${(/** @type {MouseEvent} */ e) => { e.preventDefault(); this._selectOption(option); }}
                  @mouseenter=${() => { this.highlightIndex = i; }}
                >${leading ? html`<span class="select-leading">${leading}</span>` : ""}<span class="select-option-label">${this._getLabel(option)}</span>${this.isSelected(this._getValue(option)) ? html`<lc-icon name="check" size="14" class="select-check"></lc-icon>` : ""}</div>`;
              })}
          </div>` : nothing}
      </div>
    `;
  },

  renderSearchable() {
    const { disabled, required, placeholder, label } = this;
    const id = this.selectId;
    const filtered = this._getFilteredOptions();
    const displayValue = this.open ? this.search : this._getSelectedLabel();

    return html`
      ${label ? html`<lc-label for=${id} text=${label} ?required=${required}></lc-label>` : ""}
      <div class="select-wrapper">
        <input
          type="text"
          id=${id}
          .value=${displayValue}
          ?disabled=${disabled}
          placeholder=${placeholder || lcText("lc-select", "search")}
          autocomplete="off"
          @focus=${this._onSearchFocus}
          @input=${this._onSearchInput}
          @change=${(e) => e.stopPropagation()}
          @keydown=${this._onSearchKeydown}
          class="select-search-input"
        />
        <lc-icon name="chevron-down" class="select-arrow select-arrow-toggle"
          @mousedown=${this._toggleDropdown}></lc-icon>
        ${this.open ? html`
          <div class="select-dropdown">
            ${filtered.length === 0
              ? html`<div class="select-option select-no-results">${lcText("lc-select", "noResults")}</div>`
              : filtered.map(
                  (option, i) => html`
                <div
                  class="select-option ${i === this.highlightIndex ? "highlighted" : ""} ${this.isSelected(this._getValue(option)) ? "selected" : ""}"
                  @mousedown=${(e) => {
                    e.preventDefault();
                    this._selectOption(option);
                  }}
                  @mouseenter=${() => { this.highlightIndex = i; }}
                >
                  ${this._getLeading(option) ? html`<span class="select-leading">${this._getLeading(option)}</span>` : ""}${this._getLabel(option)}
                </div>
              `,
                )
            }
          </div>
        ` : nothing}
      </div>
    `;
  },

  render() {
    if (this.searchable && this.multiple) return this.renderTags();
    if (this.searchable) return this.renderSearchable();

    const { value, disabled, required, placeholder, name, label, options } =
      this;
    const id = this.selectId;
    return html`
        ${label ? html`<lc-label for=${id} text=${label} ?required=${required}></lc-label>` : ""}
        <div class="select-wrapper">
          <select
            id=${id}
            name=${name || ""}
            value=${this.multiple ? "" : value || ""}
            ?multiple=${this.multiple}
            ?disabled=${disabled}
            ?required=${required}
            @input=${this._onInput.bind(this)}
            @change=${this._onChange.bind(this)}
          >
            ${
              placeholder && !this.multiple && !value
                ? html`<option value="" disabled selected hidden>
                  ${placeholder}
                </option>`
                : ""
            }
            ${options.map(
              (option) => html`
                <option
                  value=${option.value ?? option}
                  ?selected=${this.isSelected(option.value ?? option)}
                >
                  ${option.label ?? option}
                </option>
              `,
            )}
          </select>
          <lc-icon name="chevron-down" class="select-arrow"></lc-icon>
        </div>
    `;
  },
});

/**
 * Copyright (c) Alan Carlos Meira Leal
 *
 * Select Component
 *
 * @component
 * @category form
 * @tag lc-select
 *
 * A native select dropdown with consistent styling. Accepts an options array
 * and integrates with HTML forms. `searchable` makes it a field you type into
 * to find the option, the ones a word of which starts with the letters first;
 * `searchable` with `multiple` draws what is picked as tags, each with an x,
 * with the field for the next one after them (Backspace in an empty field takes
 * the last off) and at most `max` of them, counted beside the label. An option
 * may carry `leading`, a flag or an emoji drawn before its label everywhere it
 * shows.
 *
 * @example Basic Select
 * ```html
 * <lc-select
 *   value="option2"
 *   options='["Option 1", "Option 2", "Option 3"]'
 * ></lc-select>
 * ```
 *
 * @example With Label and Placeholder
 * ```html
 * <lc-select
 *   label="Choose Color"
 *   placeholder="Select a color..."
 *   options='[
 *     { "value": "red", "label": "Red" },
 *     { "value": "green", "label": "Green" },
 *     { "value": "blue", "label": "Blue" }
 *   ]'
 * ></lc-select>
 * ```
 *
 * @example In a Form
 * ```html
 * <form>
 *   <lc-select
 *     name="country"
 *     label="Country"
 *     required
 *     options='["USA", "UK", "Canada"]'
 *   ></lc-select>
 * </form>
 * ```
 *
 * @example Typed into, several at once, as tags
 * ```html
 * <lc-select multiple searchable max="6" label="Languages you speak" placeholder="Add a language"
 *   .options=${[{ value: "pt", label: "Portuguese", leading: "🇧🇷" }, { value: "en", label: "English", leading: "🇬🇧" }]}
 * ></lc-select>
 * ```
 *
 * @example Disabled State
 * ```html
 * <lc-select
 *   disabled
 *   value="disabled"
 *   options='["This select is disabled"]'
 * ></lc-select>
 * ```
 */
