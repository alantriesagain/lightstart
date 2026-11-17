/**
 * @file A variable spec as `<lc-form>` fields: the shape a template or a snippet uses to say what it
 * needs filled in. `fieldsForModel` reads a `$form` block, `inferFields` a schema with none, and this
 * reads a spec.
 */
import { humanizeName } from "./infer-fields.ts";
import type { FormField } from "@lightstart/components/types.ts";
import type { ModelFormField, VariableFieldOptions, VariableSpec } from "./types.ts";

/** `id` or `key`: both spellings name the variable; "" when it has neither. */
export const varKey = (v: VariableSpec): string => v.id || v.key || "";

/** `defaultValue` or `default`: both give its starting value, the first winning. */
export const varDefault = (v: VariableSpec): unknown => (v.defaultValue !== undefined ? v.defaultValue : v.default);

/** The starting values a spec declares, for a fresh form. */
export const variableDefaults = (spec: readonly VariableSpec[] = []): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const v of spec) {
    const key = varKey(v);
    if (key) out[key] = varDefault(v);
  }
  return out;
};

const fieldType = (v: VariableSpec): string => {
  if (v.media) return "media-uri";
  if (v.type === "longtext") return "textarea";
  if (v.type === "list") return "array";
  if (v.type === "boolean") return "checkbox";
  return v.type || "text";
};

/** A spec's options as `<lc-form>`'s: a string stays, an object's label falls back to its value. */
const optionsOf = (options: NonNullable<VariableSpec["options"]>): NonNullable<FormField["options"]> =>
  options.map((o) => (typeof o === "string" ? o : { value: o.value, label: o.label ?? o.value }));

const toField = (v: VariableSpec, opts: VariableFieldOptions): ModelFormField => {
  const name = varKey(v);
  const field: ModelFormField = { name, label: v.label || humanizeName(name), type: fieldType(v), required: !!v.required };
  if (v.placeholder) field.placeholder = v.placeholder;
  if (v.help) field.help = v.help;
  if (v.options) field.options = optionsOf(v.options);
  if (varDefault(v) !== undefined) field.defaultValue = varDefault(v);
  if (v.min !== undefined) field.min = v.min;
  if (v.step !== undefined) field.step = v.step;
  if (v.media) field.accept = v.media;

  if (v.type !== "list") {
    if (v.max !== undefined) field.max = v.max;
    return field;
  }

  field.itemFields = (v.itemSchema ?? []).filter((item) => varKey(item)).map((item) => toField(item, opts));
  field.addLabel = opts.addLabel ?? "Add";
  field.emptyLabel = opts.emptyLabel ?? "No items yet. Click Add to begin.";
  const importer = v.dataImporter;
  const onImport = opts.onImportClick;
  if (importer !== undefined && importer.length > 0 && onImport !== undefined)
    field.actions = [{ label: "Import", icon: "import", title: `Import data from ${importer}`, onClick: () => onImport(importer) }];
  return field;
};

/** Every variable of `spec` that has a name, as a field; a `list` variable's items as its `itemFields`. */
export const variableFields = (spec: readonly VariableSpec[] = [], opts: VariableFieldOptions = {}): ModelFormField[] =>
  spec.filter((v) => varKey(v)).map((v) => toField(v, opts));
