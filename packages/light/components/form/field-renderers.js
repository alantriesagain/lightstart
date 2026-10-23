/**
 * The control each field type renders, as data.
 *
 * A renderer is `(field, value, onChange, html) => template`: `onChange` takes
 * the field's new value and `html` is the caller's template tag, so a renderer
 * never reaches for a form. `<lc-form>` looks one up per field, and a view
 * that draws its own chrome around a control looks one up directly instead of
 * dispatching on the type itself.
 *
 * The key is `field.cmsType` when there is one, else `field.type`, so a package
 * shipping a rich widget and the built-in controls share one namespace. A
 * registration under a built-in type replaces that control everywhere, which is
 * how a project rethemes one rather than reaching around it.
 */

import { html as defaultHtml, nothing } from "@bootstrapp/light/html";
import { getPath } from "./path.js";
import { lcText } from "../utils/text.js";

/** @import { FormField, FormFieldRenderer, Renderable } from "../types.ts" */

/** @type {Map<string, FormFieldRenderer>} */
const renderers = new Map();

/**
 * @param {string} type `field.cmsType` or `field.type`
 * @param {FormFieldRenderer} render
 */
export const registerFormFieldRenderer = (type, render) => {
  renderers.set(type, render);
};

/**
 * @param {string} type
 * @returns {FormFieldRenderer | undefined}
 */
export const getFormFieldRenderer = (type) => renderers.get(type);

/** Every registered key, for a caller listing what it can draw. */
export const formFieldTypes = () => [...renderers.keys()];

/**
 * The control for one field. An unknown type falls back to a text input, so
 * it draws something a person can still type into.
 *
 * @param {FormField} field
 * @param {unknown} value
 * @param {(value: unknown) => void} [onChange] only a widget needs one; a native control reports itself
 * @param {typeof defaultHtml} [html]
 * @returns {Renderable}
 */
export const renderFormControl = (field, value, onChange = () => {}, html = defaultHtml) => {
  const render = renderers.get(field.cmsType || field.type) || renderers.get("text");
  return /** @type {FormFieldRenderer} */ (render)(field, value, onChange, html);
};

/**
 * What a control now holds, however it reported it. A lc component emits its
 * own change on itself carrying `{ value }`, or `{ checked }` when what it
 * holds is a yes or a no; a plain control carries it on the element.
 * @param {Event} e
 */
const reported = (e) => {
  const detail = /** @type {CustomEvent<{ checked?: boolean, value?: unknown }>} */ (e).detail;
  if (detail && typeof detail === "object") {
    if ("checked" in detail) return detail.checked;
    if ("value" in detail) return detail.value;
  }
  const el = /** @type {{ checked?: boolean, value?: unknown, type?: string }} */ (e.target);
  return el?.type === "checkbox" ? !!el.checked : el?.value;
};

/** @param {FormField["options"]} options */
const normalizeOptions = (options) =>
  Array.isArray(options)
    ? options.map((option) => ({
        value: typeof option === "object" ? option.value : option,
        label: typeof option === "object" ? option.label : option,
        ...(typeof option === "object" && typeof option.leading === "string" ? { leading: option.leading } : {}),
      }))
    : [];

const input = (/** @type {string} */ type, /** @type {string} */ placeholder = "") =>
  /** @type {FormFieldRenderer} */ ((field, value, onChange, html) => html`
    <lc-input
      @input=${(/** @type {Event} */ e) => onChange(reported(e))}
      @change=${(/** @type {Event} */ e) => onChange(reported(e))}
      type=${type}
      name=${field.name}
      label=${field.label}
      value=${value ?? ""}
      ?required=${field.required}
      ?disabled=${field.disabled}
      ?readonly=${field.readonly}
      placeholder=${field.placeholder || placeholder}
      prefix=${field.prefix || ""}
      .min=${field.min ?? null}
      .max=${field.max ?? null}
      .step=${field.step ?? (type === "number" ? "any" : null)}
    ></lc-input>
  `);

for (const [type, placeholder] of [
  ["text", ""],
  ["number", ""],
  ["date", ""],
  ["datetime-local", ""],
  ["time", ""],
  ["password", ""],
  ["tel", ""],
  ["email", "email@example.com"],
  ["url", "https://"],
])
  registerFormFieldRenderer(type, input(type, placeholder));

registerFormFieldRenderer("color", (field, value, onChange, html) => html`
  <lc-color-picker
    @input=${(/** @type {Event} */ e) => onChange(reported(e))}
    @change=${(/** @type {Event} */ e) => onChange(reported(e))}
    name=${field.name}
    value=${typeof value === "string" ? value : ""}
    ?required=${field.required}
    ?disabled=${field.disabled}
    ?readonly=${field.readonly}
    ?alpha=${Boolean(/** @type {{ alpha?: boolean }} */ (field).alpha)}
    ?allow-clear=${!field.required}
    .swatches=${normalizeOptions(field.options).map((option) => String(option.value))}
  ></lc-color-picker>
`);
registerFormFieldRenderer("week-hours", (field, value, onChange, html) => html`
  <lc-week-hours
    @change=${(/** @type {Event} */ e) => onChange(reported(e))}
    name=${field.name}
    label=${field.label}
    ?disabled=${field.disabled}
    .value=${Array.isArray(value) ? value : []}
  ></lc-week-hours>
`);
registerFormFieldRenderer("textarea", (field, value, onChange, html) => html`
  <lc-textarea
    @input=${(/** @type {Event} */ e) => onChange(reported(e))}
    @change=${(/** @type {Event} */ e) => onChange(reported(e))}
    name=${field.name}
    label=${field.label}
    value=${value || ""}
    ?required=${field.required}
    ?disabled=${field.disabled}
    ?readonly=${field.readonly}
    placeholder=${field.placeholder || ""}
    rows=${field.rows || 3}
  ></lc-textarea>
`);

registerFormFieldRenderer("select", (field, value, onChange, html) => html`
  <lc-select
    @change=${(/** @type {Event} */ e) => onChange(reported(e))}
    name=${field.name}
    label=${field.label}
    ?searchable=${Boolean(field.searchable)}
    ?required=${field.required}
    ?disabled=${field.disabled}
    value=${value || ""}
    placeholder=${field.placeholder || lcText("lc-select", "placeholder")}
    .options=${normalizeOptions(field.options)}
  ></lc-select>
`);

registerFormFieldRenderer("multi-select", (field, value, onChange, html) => html`
  <lc-select
    @change=${(/** @type {Event} */ e) => onChange(reported(e))}
    name=${field.name}
    label=${field.label}
    multiple
    searchable
    .max=${Number(field.max) || 0}
    placeholder=${field.placeholder || ""}
    ?required=${field.required}
    ?disabled=${field.disabled}
    .value=${Array.isArray(value) ? value : []}
    .options=${normalizeOptions(field.options)}
  ></lc-select>
`);

const checkbox = /** @type {FormFieldRenderer} */ ((field, value, onChange, html) => html`
  <lc-checkbox
    @change=${(/** @type {Event} */ e) => onChange(reported(e))}
    name=${field.name}
    ?checked=${value === true}
    ?disabled=${field.disabled}
    label=${field.checkboxLabel ?? `Enable ${field.label}`}
  ></lc-checkbox>
`);
registerFormFieldRenderer("checkbox", checkbox);
registerFormFieldRenderer("switch", checkbox);

registerFormFieldRenderer("file", (field, value, onChange, html) => html`
  <lc-file-upload
    @change=${(/** @type {Event} */ e) => onChange(/** @type {CustomEvent<{ value?: unknown }>} */ (e).detail?.value)}
    name=${field.name}
    accept=${field.accept || ""}
    ?required=${field.required}
    ?disabled=${field.disabled}
    .maxSize=${field.maxSize ?? null}
    .value=${value ?? null}
  ></lc-file-upload>
`);

registerFormFieldRenderer("files", (field, value, onChange, html) => html`
  <lc-file-upload
    @change=${(/** @type {Event} */ e) => onChange(/** @type {CustomEvent<{ value?: unknown }>} */ (e).detail?.value)}
    name=${field.name}
    accept=${field.accept || ""}
    multiple
    ?required=${field.required}
    ?disabled=${field.disabled}
    .maxSize=${field.maxSize ?? null}
    .value=${Array.isArray(value) ? value : value == null ? [] : [value]}
  ></lc-file-upload>
`);

registerFormFieldRenderer("json", (field, value, onChange, html) => html`
  <lc-textarea
    @input=${(/** @type {Event} */ e) => onChange(reported(e))}
    @change=${(/** @type {Event} */ e) => onChange(reported(e))}
    name=${field.name}
    label=${field.label}
    value=${typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)}
    ?required=${field.required}
    ?disabled=${field.disabled}
    ?readonly=${field.readonly}
    placeholder=${field.placeholder || "{}"}
    rows=${field.rows || 6}
    class="lc-form-json"
  ></lc-textarea>
`);

registerFormFieldRenderer("object", (field, value, onChange, html) => {
  const children = (field.fields || []).map((child) =>
    renderFormControl(
      { ...child, name: `${field.name}.${child.name}` },
      getPath(value, child.name),
      (/** @type {unknown} */ next) => onChange({ ...(value && typeof value === "object" ? value : {}), [child.name]: next }),
      html,
    ));
  if (field.collapsible)
    return html`
      <lc-accordion variant="bordered" class="lc-form-group-accordion">
        <div slot="title">${field.label || field.name}</div>
        <div class="lc-form-group-body">${children}</div>
      </lc-accordion>
    `;
  return html`
    <fieldset class="lc-form-group">
      ${field.label ? html`<legend>${field.label}</legend>` : ""}
      ${children}
    </fieldset>
  `;
});

registerFormFieldRenderer("array", (field, value, onChange, html) => {
  const items = Array.isArray(value) ? value : [];
  const children = field.itemFields || [];
  const single = !children.length && field.itemField ? field.itemField : null;
  const blank = () => (single
    ? single.defaultValue ?? null
    : Object.fromEntries(children.map((child) => [child.name, child.defaultValue ?? null])));
  const at = (/** @type {number} */ index, /** @type {Record<string, unknown>} */ entry) =>
    onChange(items.map((item, i) => (i === index ? entry : item)));
  const move = (/** @type {number} */ index, /** @type {number} */ by) => {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };
  const full = field.max != null && items.length >= Number(field.max);

  return html`
    <fieldset class="lc-form-list">
      ${field.label ? html`<legend>${field.label}</legend>` : ""}
      ${items.length === 0 ? html`<p class="lc-form-list-empty">${field.emptyLabel || lcText("lc-field", "nothingYet")}</p>` : ""}
      ${items.map((item, index) => html`
        <div class="lc-form-list-item">
          <div class="lc-form-list-fields">
            ${single
              ? renderFormControl(
                  { ...single, name: `${field.name}[${index}]`, label: single.label || "" },
                  item,
                  (/** @type {unknown} */ next) => onChange(items.map((entry, i) => (i === index ? next : entry))),
                  html,
                )
              : children.map((child) =>
                  renderFormControl(
                    { ...child, name: `${field.name}[${index}].${child.name}` },
                    getPath(item, child.name),
                    (/** @type {unknown} */ next) => at(index, { ...(item && typeof item === "object" ? item : {}), [child.name]: next }),
                    html,
                  ))}
          </div>
          <div class="lc-form-list-actions">
            <lc-button size="xs" ghost icon="chevron-up" ?disabled=${index === 0}
              @click=${() => move(index, -1)}></lc-button>
            <lc-button size="xs" ghost icon="chevron-down" ?disabled=${index === items.length - 1}
              @click=${() => move(index, 1)}></lc-button>
            <lc-button size="xs" ghost icon="x"
              @click=${() => onChange(items.filter((_, i) => i !== index))}></lc-button>
          </div>
        </div>
      `)}
      <div class="lc-form-list-add">
        <lc-button size="sm" ?disabled=${full || field.disabled}
          @click=${() => onChange([...items, blank()])}>${field.addLabel || `Add ${field.label || field.name}`}</lc-button>
        ${(field.actions || []).map((action) => html`
          <lc-button size="sm" ghost icon=${action.icon || nothing} title=${action.title || action.label}
            ?disabled=${field.disabled}
            @click=${() => action.onClick?.(items)}>${action.label}</lc-button>
        `)}
      </div>
    </fieldset>
  `;
});

const BUILT_IN = new Set(renderers.keys());

/**
 * Whether the control drawn for `field` labels itself. The built-in controls
 * do (a lc input carries its label, a group its legend), so `<lc-form>` adds
 * one only above a registered widget, which draws just the control. A renderer
 * registered under a built-in name replaces a control that labelled itself and
 * is expected to do the same.
 * @param {FormField} field
 */
export const drawsOwnLabel = (field) => BUILT_IN.has(field.cmsType || field.type);
