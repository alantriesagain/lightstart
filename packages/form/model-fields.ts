/**
 * @file A model schema's `$form` block as `<lc-form>` fields. The field's control metadata
 * (`label`, `placeholder`, `input`, `rows`, `cmsType`) lives on its `T.*` definition; a `select`'s
 * option labels come from an optional labels map.
 */
import { definitionOf, formBlockOf } from "./schema.ts";
import type { ModelFieldDef, ModelFormField, OptionLabels } from "./types.ts";

const humanize = (name: string): string =>
  name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

const enumLabel = (labels: OptionLabels, name: string, value: string): string => {
  const entry = labels[name]?.[value];
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null && "label" in entry && typeof entry.label === "string" && entry.label.length > 0) return entry.label;
  return humanize(value);
};

/**
 * `input` is what the author asked for and wins. `fieldType` is how the store holds the value, and a
 * file is the one kind a text input cannot stand in for: light's validation accepts a Blob against a
 * string field only when the field declares `fieldType: "file"`.
 */
const fieldType = (def: ModelFieldDef): string => {
  if (def.input) return def.input;
  if (def.fieldType === "file") return def.$type === "array" ? "files" : "file";
  if (def.fieldType === "files") return "files";
  if (def.$type === "array") return "array";
  if (def.enum) return "select";
  if (def.$type === "number") return "number";
  if (def.$type === "boolean") return "checkbox";
  return "text";
};

/** One field from its name and `T.*` definition: the metadata rules every field keeps, an array item's too. */
const fieldOf = (name: string, def: ModelFieldDef, labels: OptionLabels): ModelFormField => {
  const field: ModelFormField = { name, label: def.label || humanize(name), type: fieldType(def), required: !!def.required };
  if (def.placeholder) field.placeholder = def.placeholder;
  if (def.rows) field.rows = def.rows;
  if (def.cmsType) field.cmsType = def.cmsType;
  const named = labels[name];
  if (def.enum) field.options = def.enum.map((v) => ({ value: v, label: enumLabel(labels, name, v) }));
  else if (field.type === "multi-select" && named !== undefined) field.options = Object.keys(named).map((v) => ({ value: v, label: enumLabel(labels, name, v) }));
  return field;
};

/** An array item's `props`, whether `itemType` is a `T.object` or the props themselves. */
const itemProps = (item: ModelFieldDef): Record<string, unknown> | null => {
  if (typeof item.props === "object" && item.props !== null && !Array.isArray(item.props)) return item.props;
  return item.$type === undefined ? (item as Record<string, unknown>) : null;
};

/** The fields `modelSchema.$form.fields` names, in that order (a name the schema has no field for is dropped); no schema or no block answers none. */
export const fieldsForModel = (modelSchema?: object, { labels = {} }: { labels?: OptionLabels } = {}): ModelFormField[] => {
  if (modelSchema === undefined) return [];
  const block = formBlockOf(modelSchema)?.fields;
  const names: string[] = Array.isArray(block) ? block : [];
  const fields: ModelFormField[] = [];
  for (const name of names) {
    const def = definitionOf((modelSchema as Record<string, unknown>)[name]);
    if (def === null) continue;
    const field = fieldOf(name, def, labels);
    if (field.type === "array") {
      const item = definitionOf(def.itemType);
      if (item !== null) {
        const props = itemProps(item);
        if (props === null) field.itemField = fieldOf(name, item, labels);
        else {
          const itemFields: ModelFormField[] = [];
          for (const [propName, raw] of Object.entries(props)) {
            const prop = definitionOf(raw);
            if (prop !== null) itemFields.push(fieldOf(propName, prop, labels));
          }
          field.itemFields = itemFields;
        }
      }
    }
    fields.push(field);
  }
  return fields;
};

/** The payload defaults a model's `$form.defaults` declares. */
export const formDefaults = (modelSchema?: object): Record<string, unknown> => (modelSchema === undefined ? {} : formBlockOf(modelSchema)?.defaults ?? {});
