/// <reference lib="dom" />
/**
 * @file The types of `@lightstart/form`: what a model's field definitions may say about their form
 * control, the `$form` block a schema declares, a field as the package answers it, and a variable
 * spec. `FormField` is `<lc-form>`'s prop contract in `@lightstart/components`; a field here extends
 * it, a type-only edge with no runtime import.
 */
import type { FormField } from "@lightstart/components/types.ts";

/** A field derived from a schema always carries its label and whether it is required. */
export interface ModelFormField extends FormField {
  label: string;
  required: boolean;
}

/** The form metadata a model's `T.*` field definition may carry. */
export interface ModelFieldDef {
  label?: string;
  help?: string;
  secret?: boolean;
  placeholder?: string;
  input?: string;
  cmsType?: string;
  rows?: number;
  enum?: readonly string[];
  $type?: string;
  required?: boolean;
  fieldType?: string;
  relationship?: string;
  targetModel?: string;
  immutable?: boolean;
  attribute?: boolean;
  defaultValue?: unknown;
}

/** The `$form` block a model schema declares: the fields a person fills in, in order, and the payload's defaults. */
export interface ModelFormBlock {
  label?: string;
  order?: number;
  fields?: string[];
  defaults?: Record<string, unknown>;
}

/** A model schema as `fieldsForModel` reads it. */
export type ModelFormSchema = Record<string, ModelFieldDef | undefined> & {
  $form?: ModelFormBlock;
};

/** Field name to message: what `validateRow` answers and `<lc-form>`'s `setErrors` takes. */
export type FieldErrors = Record<string, string>;

/** Option labels by field and value, for a `select`: a label, or an object with one (`{ status: { open: "Open", closed: { label: "Closed" } } }`). */
export type OptionLabels = Record<string, Record<string, unknown>>;

/**
 * What a template or a snippet says it needs filled in. It is not a model schema: both spellings
 * of a name (`id`, `key`) and of a default (`defaultValue`, `default`) are accepted, and its type
 * words include `longtext` and `list`.
 */
export interface VariableSpec {
  id?: string;
  key?: string;
  /** A variable with no label of its own is drawn by a humanized version of its key. */
  label?: string;
  type?: string;
  default?: unknown;
  defaultValue?: unknown;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<string | { label?: unknown; value?: unknown }>;
  itemSchema?: VariableSpec[];
  dataImporter?: string;
  min?: number;
  max?: number;
  step?: number;
  media?: string;
  [key: string]: unknown;
}

/** How `variableFields` draws a `list` variable. */
export interface VariableFieldOptions {
  /** Called with the importer a `list` variable names, when the caller can handle one. */
  onImportClick?: (importerId: string) => void;
  addLabel?: string;
  emptyLabel?: string;
}
