import { html } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { getFormFieldRenderer, renderFormControl, drawsOwnLabel } from "./field-renderers.js";
import { getPath, setPath } from "./path.js";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";

const TAG = /** @type {const} */ ("lc-form");

/** @import { FormControlElement, FormField, FormTypeHandlers, Prop, Renderable } from "../types.ts" */

/**
 * A control's name is a path when it addresses one leaf of a repeated group
 * (`links[0].url`), and a plain key otherwise.
 * @param {Record<string, unknown>} target
 * @param {string} name
 * @param {unknown} value
 */
const write = (target, name, value) => {
  if (name.includes(".") || name.includes("[")) setPath(target, name, value);
  else target[name] = value;
};

/** @param {number} n */
const pad = (n) => String(n).padStart(2, "0");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * What a `<input type="date">` or `type="datetime-local"` shows is a wall
 * clock, so both are read in the viewer's own zone.
 *
 * Two values need no reading at all. A date-only string carries no zone, so
 * reinterpreting it in one is what makes `"2026-01-15"` show as the 14th east
 * of it and the 16th west; it is already the answer. A wall-clock string is
 * likewise already in the shape the input wants.
 *
 * Everything else is an instant, and going through `toISOString()` converts it
 * to UTC before the day is sliced off, which shows a late local time as the
 * next day and an early one correctly: silent for most of the day.
 *
 * @param {unknown} value
 * @param {boolean} [withTime]
 */
const forDateInput = (value, withTime = false) => {
  if (typeof value === "string") {
    if (DATE_ONLY.test(value)) return withTime ? `${value}T00:00` : value;
    if (WALL_CLOCK.test(value) && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(value))
      return withTime ? value.slice(0, 16) : value.slice(0, 10);
  }
  const at = new Date(/** @type {string | number | Date} */ (value));
  if (Number.isNaN(at.getTime())) return value;
  const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  return withTime ? `${day}T${pad(at.getHours())}:${pad(at.getMinutes())}` : day;
};

export default defineComponent({
  tag: "lc-form",
  style: true,

  props: {
    fields: /** @type {Prop<FormField[]>} */ (T.array({ defaultValue: [] })),
    data: /** @type {Prop<Record<string, unknown>>} */ (T.object({ defaultValue: {} })),
    loading: false,
    typeHandlers: /** @type {Prop<FormTypeHandlers>} */ (
      T.object({ attribute: false, defaultValue: {} })
    ),
    errors: /** @type {Prop<Record<string, unknown>>} */ (T.object({ defaultValue: {} })),
    layout: T.string({ defaultValue: "grid", enum: ["grid", "stacked"] }),
    _options: /** @type {Prop<Record<string, { loading: boolean, options: unknown[], error: string }>>} */ (
      T.object({ attribute: false, defaultValue: () => ({}) })
    ),
    _loads: /** @type {Prop<Map<string, number>>} */ (T.object({ reactive: false, defaultValue: () => new Map() })),
  },

  events: {
    "field-change": T.object({ name: T.string(), value: T.any(), values: T.object() }),
    "form-invalid": T.object({ errors: T.object() }),
  },

  connected() {
    for (const field of this.fields || [])
      if (field.loadOptions) void this.loadFieldOptions(field);

    const onEdit = (/** @type {Event} */ e) => this._onControlEdit(e);
    const onInvalid = (/** @type {Event} */ e) => this._onControlInvalid(e);
    this.addEventListener("input", onEdit, true);
    this.addEventListener("change", onEdit, true);
    this.addEventListener("invalid", onInvalid, true);
    this.$own(() => {
      this.removeEventListener("input", onEdit, true);
      this.removeEventListener("change", onEdit, true);
      this.removeEventListener("invalid", onInvalid, true);
    });
  },

  /**
   * A native control the platform refused. It fires one `invalid` per failing
   * control and then submits nothing, so this is where a submit driven by a
   * plain `<button type="submit">` gets its reason drawn.
   *
   * @param {Event} e
   */
  _onControlInvalid(e) {
    const target = /** @type {Element & { name?: string, validationMessage?: string } } */ (e.target);
    const name = target?.getAttribute?.("name") || target?.name;
    if (!name) return;
    const field = this.getFieldConfig(name);
    if (!field.name) return;
    this.errors = { ...this.errors, [name]: target.validationMessage || lcText(TAG, "required", { label: field.label || name }) };
  },

  /**
   * Field name to message: the shape `validateRow` answers with, so
   * `form.setErrors(err.errors)` is the one line for a rejection whether the
   * schema refused the payload here or the worker refused the write.
   * @param {Record<string, string> | null | undefined} errors
   */
  setErrors(errors) {
    this.errors = errors ? { ...errors } : {};
  },

  clearErrors() {
    this.errors = {};
  },

  /**
   * The visible fields that are required and empty.
   *
   * The platform already refuses to submit a form holding an empty required
   * native control, but it refuses in silence: nothing is emitted and nothing
   * is drawn, which reads as a dead button. And a field rendered by a
   * `cmsType` or a `typeHandlers` widget has no native control at all, so its
   * `required` is invisible to the platform.
   *
   * This is the control-level check, not the schema's: `@bootstrapp/form`
   * runs the model's own rules on a payload that may never have had a DOM.
   *
   * @returns {Record<string, string>}
   */
  validate() {
    const values = this.collectFormData();
    /** @type {Record<string, string>} */
    const errors = {};
    for (const field of this.visibleFields()) {
      if (!field.required) continue;
      const value = values[field.name];
      const empty = value === undefined || value === null || value === ""
        || (Array.isArray(value) && value.length === 0);
      if (empty) errors[field.name] = lcText(TAG, "required", { label: field.label || field.name });
    }
    return errors;
  },

  /**
   * Submit, or draw why not. Answers whether it went.
   * @returns {boolean}
   */
  submit() {
    const errors = this.validate();
    if (Object.keys(errors).length) {
      this.setErrors(errors);
      this.$emit("form-invalid", { errors });
      return false;
    }
    const form = this.querySelector("form");
    if (!form) return false;
    form.requestSubmit();
    return true;
  },

  /** @returns {NodeListOf<FormControlElement>} */
  getFormControls() {
    return this.querySelectorAll(
      "lc-input, lc-select, lc-textarea, lc-checkbox, lc-switch, lc-file-upload, input, select, textarea",
    );
  },

  /**
   * @param {string} name
   * @returns {FormField}
   */
  getFieldConfig(name) {
    return /** @type {FormField} */ (this.fields.find((f) => f.name === name) || {});
  },

  /**
   * Whether a field is on screen. `visibleIf` is the name of another field
   * that has to be truthy, or a predicate over the current values. A field
   * that is not shown is not collected either: a payload carrying a value
   * nobody could see is how a hidden branch ends up in the database.
   *
   * @param {FormField} field
   * @param {Record<string, unknown>} [values]
   * @returns {boolean}
   */
  isFieldVisible(field, values) {
    const { visibleIf } = field;
    if (!visibleIf) return true;
    const current = values ?? this.data;
    if (typeof visibleIf === "function") return !!visibleIf(current);
    return !!current[visibleIf];
  },

  visibleFields() {
    return (this.fields || []).filter((field) => this.isFieldVisible(field));
  },

  /**
   * One field changed. The value is written into `data` so a re-render keeps
   * it and a `visibleIf` depending on it re-evaluates, then announced.
   *
   * @param {FormField} field
   * @param {unknown} value
   */
  _fieldChanged(field, value) {
    this.data = { ...this.data, [field.name]: value };
    this.$emit("field-change", { name: field.name, value, values: this.data });
    this._reloadDependents(field.name);
  },

  /**
   * Reload every field whose options came from the one that just changed, and
   * clear what each was holding: a list loaded for one account says nothing
   * about another.
   *
   * @param {string} changed
   */
  _reloadDependents(changed) {
    for (const field of this.fields || []) {
      const depends = field.dependsOn;
      if (!depends) continue;
      const on = Array.isArray(depends) ? depends : [depends];
      if (!on.includes(changed)) continue;
      if (this.data[field.name] !== undefined && this.data[field.name] !== "")
        this.data = { ...this.data, [field.name]: Array.isArray(this.data[field.name]) ? [] : "" };
      void this.loadFieldOptions(field);
    }
  },

  /**
   * Ask a field for its options. The answer is kept per field, along with
   * whether it is still coming and why it did not.
   *
   * @param {FormField} field
   * @returns {Promise<void>}
   */
  async loadFieldOptions(field) {
    if (!field.loadOptions) return;
    const load = (this._loads.get(field.name) ?? 0) + 1;
    this._loads.set(field.name, load);
    const held = this._options[field.name]?.options ?? [];
    this._options = { ...this._options, [field.name]: { loading: true, options: held, error: "" } };
    try {
      const options = await field.loadOptions(this.data);
      if (this._loads.get(field.name) !== load) return;
      this._options = { ...this._options, [field.name]: { loading: false, options: options || [], error: "" } };
    } catch (error) {
      if (this._loads.get(field.name) !== load) return;
      this._options = {
        ...this._options,
        [field.name]: { loading: false, options: [], error: error instanceof Error ? error.message : lcText(TAG, "loadFailed") },
      };
    }
  },

  /**
   * The field as it is drawn: its loaded options, plus whatever it currently
   * holds if that is not among them, so a saved value stays selected while its
   * options are still coming.
   *
   * @param {FormField} field
   * @param {unknown} value
   * @returns {FormField}
   */
  _withOptions(field, value) {
    if (!field.loadOptions) return field;
    const state = this._options[field.name];
    const options = /** @type {Array<string | { value: unknown, label: unknown }>} */ (state?.options ?? []);
    const held = Array.isArray(value) ? value : value === "" || value == null ? [] : [value];
    const known = new Set(options.map((option) => (typeof option === "object" ? option.value : option)));
    const missing = held.filter((entry) => !known.has(entry)).map((entry) => ({ value: entry, label: String(entry) }));
    return {
      ...field,
      options: [...options, ...missing],
      disabled: field.disabled || !!state?.loading,
      ...(state?.error ? { help: state.error } : {}),
    };
  },

  collectFormData() {
    const controls = this.getFormControls();
    /** @type {Record<string, unknown>} */
    const data = {};
    const shown = new Set(this.visibleFields().map((field) => field.name));

    for (const field of this.fields || [])
      if (shown.has(field.name)
        && (field.cmsType || field.type === "object" || field.type === "array" || this.typeHandlers[field.type]?.render)
        && this.data[field.name] !== undefined)
        data[field.name] = this.data[field.name];

    controls.forEach((el) => {
      const name = el.getAttribute("name") || el.name;
      if (!name || !shown.has(name)) return;

      const tagName = el.tagName.toLowerCase();
      const fieldConfig = this.getFieldConfig(name);

      if (
        tagName === "lc-checkbox" ||
        tagName === "lc-switch" ||
        el.type === "checkbox"
      ) {
        write(data, name, el.checked === true);
        return;
      }

      if (el.type === "number" || el.getAttribute("type") === "number") {
        const val = el.value;
        write(data, name, val !== "" && val !== null && val !== undefined ? parseFloat(String(val)) : null);
        return;
      }

      if (tagName === "lc-file-upload") {
        write(data, name, /** @type {{ value?: unknown }} */ (el).value ?? (fieldConfig.type === "files" ? [] : null));
        return;
      }

      const isMultiple =
        el.multiple ||
        el.hasAttribute("multiple") ||
        fieldConfig.type === "multi-select";

      if (isMultiple) {
        const value = el.value;
        write(data, name, Array.isArray(value) ? value : value && value !== "" ? [value] : []);
        return;
      }

      const value = el.value;
      write(data, name, value === "" || value === undefined ? null : value);
    });

    return data;
  },

  /** @param {Record<string, unknown>} formData */
  serialize(formData) {
    const result = { ...formData };

    for (const field of this.fields || []) {
      const value = result[field.name];
      if (value === undefined || value === null) continue;
      if (field.type === "file" || field.type === "files") continue;

      if (this.typeHandlers[field.type]) {
        result[field.name] =
          this.typeHandlers[field.type].serialize?.(value, field) ?? value;
        continue;
      }

      switch (field.type) {
        case "json":
          if (typeof value === "string")
            try {
              result[field.name] = JSON.parse(value);
            } catch {

            }

          break;
        case "textarea":
          if (
            field.name.includes("json") ||
            typeof field.defaultValue === "object"
          )
            try {
              result[field.name] = JSON.parse(/** @type {string} */ (value));
            } catch {

            }

          break;
        case "number":
          if (typeof value === "string")
            result[field.name] = value === "" ? null : parseFloat(value) || 0;

          break;
        case "switch":
        case "checkbox":
          if (typeof value === "string")
            result[field.name] = value === "true" || value === "1";

          break;
      }
    }

    return result;
  },

  /** @param {Record<string, unknown>} record */
  deserialize(record) {
    const result = { ...record };

    for (const field of this.fields || []) {
      const value = result[field.name];
      if (value === undefined) continue;

      if (this.typeHandlers[field.type]) {
        result[field.name] =
          this.typeHandlers[field.type].deserialize?.(value, field) ?? value;
        continue;
      }

      switch (field.type) {
        case "json":
          if (typeof value !== "string") result[field.name] = JSON.stringify(value, null, 2);

          break;
        case "textarea":
          if (
            Array.isArray(value) ||
            (typeof value === "object" && value !== null)
          )
            result[field.name] = JSON.stringify(value, null, 2);

          break;
        case "date":
          if (value) result[field.name] = forDateInput(value);

          break;
        case "datetime-local":
          if (value) result[field.name] = forDateInput(value, true);

          break;
      }
    }

    return result;
  },

  /**
   * One listener announces every edit, rather than thirteen renderers each
   * wiring their own.
   *
   * It has to run in the capture phase: a control stops the native event so
   * its own re-emitted one is the public surface, and `$emit` does not bubble,
   * so nothing reaches an ancestor either way. Capture sees the event on the
   * way down, before the control takes it.
   *
   * The read is deferred to a microtask because capture is too early: the
   * control has not written its own `value` yet. A microtask queued during a
   * dispatch runs once that dispatch has finished, which is exactly late
   * enough and never later.
   *
   * @param {Event} e
   */
  _onControlEdit(e) {
    const target = /** @type {Element & { name?: string }} */ (e.target);
    const name = target?.getAttribute?.("name") || target?.name;
    if (!name || !this.getFieldConfig(name).name) return;
    queueMicrotask(() => this._announceEdit(name));
  },

  /** @param {string} name */
  _announceEdit(name) {
    if (!this.isConnected) return;
    const value = this.collectFormData()[name];
    if (value === this.data[name]) return;
    this._fieldChanged(this.getFieldConfig(name), value);
  },

  /** @param {Event} e */
  _handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    this.errors = {};

    const rawData = this.collectFormData();
    const serialized = this.serialize(rawData);
    this.$emit("form-submit", serialized);
  },

  /**
   * The control for one field: the form's own `typeHandlers` escape hatch
   * first, then whatever the registry holds for the field's `cmsType` or its
   * `type`, then a text input.
   *
   * @param {FormField} field
   * @param {unknown} value
   * @returns {Renderable}
   */
  renderField(field, value) {
    const typeRender = this.typeHandlers[field.type]?.render;
    if (typeRender)
      return typeRender(field, value, (/** @type {unknown} */ newValue) => this._fieldChanged(field, newValue));

    const owns = field.type === "object" || field.type === "array" || !!(field.cmsType && getFormFieldRenderer(field.cmsType));
    const onChange = owns
      ? (/** @type {unknown} */ newValue) => this._fieldChanged(field, newValue)
      : () => queueMicrotask(() => this._announceEdit(field.name));
    return renderFormControl(field, value, onChange, html);
  },

  render() {
    const formData = this.deserialize(this.data || {});

    return html`
      <form @submit=${this._handleSubmit}>
        ${this.visibleFields().map((original) => {
          const value = formData[original.name];
          const field = this._withOptions(original, value);
          const error = this.errors[field.name];
          const hint = field.help || field.description;
          return html`
            <div class="form-field ${field.class || ""} ${error ? "has-error" : ""}">
              ${field.label && !drawsOwnLabel(field) ? html`<lc-label text=${field.label} ?required=${field.required}></lc-label>` : ""}
              ${this.renderField(field, value)}
              ${hint ? html`<small class="form-hint">${hint}</small>` : ""}
              ${error ? html`<span class="form-error">${error}</span>` : ""}
            </div>
          `;
        })}
      </form>
    `;
  },
});
