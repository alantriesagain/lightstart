/**
 * @file A form's payload validated against the model it writes to. `validateRow` walks every field
 * of the model, which is right for a write and wrong for a form: the generated fields (`id`, a
 * timestamp) are not among those a person fills in. So the model's validator runs on the whole row
 * (cross-field validators still see everything) and its result is narrowed to the fields the form
 * shows, each message keyed to the field's label.
 */
import { validateRow } from "@lightstart/light/model/adapter";
import type { ModelSchema, Row } from "@lightstart/light/model/types.ts";
import type { FieldErrors, ModelFormField } from "./types.ts";

const scopeToFields = (fields: readonly ModelFormField[], errors: Record<string, string>): FieldErrors => {
  const shown = new Map(fields.map((field) => [field.name, field.label || field.name]));
  const scoped: FieldErrors = {};
  for (const [field, message] of Object.entries(errors)) {
    const label = shown.get(field);
    if (label === undefined) continue;
    scoped[field] = message.startsWith(`${field} `) ? `${label}${message.slice(field.length)}` : message;
  }
  return scoped;
};

/** Validate `data` against model `model` of `models`, reporting only the fields the form shows. */
export const validateForm = (
  models: Record<string, ModelSchema>,
  model: string,
  data: Row,
  fields: readonly ModelFormField[],
  options: { operation?: "add" | "edit" } = {},
): { valid: boolean; errors: FieldErrors } => {
  const { errors } = validateRow(models, model, data, options);
  if (errors["_model"] !== undefined) return { valid: false, errors: { _model: errors["_model"] } };
  const scoped = scopeToFields(fields, errors);
  return { valid: Object.keys(scoped).length === 0, errors: scoped };
};

/** The required fields a form answers for itself, before any model: a form with no model still refuses an empty required field. */
export const validateRequired = (data: Record<string, unknown>, fields: readonly ModelFormField[]): { valid: boolean; errors: FieldErrors } => {
  const errors: FieldErrors = {};
  for (const field of fields) {
    if (!field.required) continue;
    const value = data[field.name];
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (empty) errors[field.name] = `${field.label || field.name} is required`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
};
