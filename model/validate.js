/** @import { ModelSchema, Row } from "./types.ts" */

/** A write the schema rejects; `errors` maps each failing field to its message. */
export class ValidationError extends Error {
  /**
   * @param {string} model
   * @param {Record<string, string>} errors
   */
  constructor(model, errors) {
    super(`Validation failed for "${model}": ${Object.values(errors).join("; ")}`);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

/** @type {Record<string, string[]>} */
const VALID_TYPES = {
  string: ["string", "number"],
  number: ["number", "string"],
  boolean: ["boolean", "number", "string"],
  object: ["object"],
  array: ["array"],
  date: ["object", "number", "string"],
  datetime: ["object", "number", "string"],
};

/** @type {Record<string, RegExp>} */
const FORMATS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
};

/**
 * Validate a row against its schema: required fields (on add), value types,
 * the field's own `validator`, and `format`. Relation fields are validated as
 * the ids they are stored as.
 *
 * @param {Record<string, ModelSchema>} models
 * @param {string} modelName
 * @param {Row} row
 * @param {{ operation?: "add" | "edit" }} [options]
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateRow(models, modelName, row, options = {}) {
  const modelSchema = models[modelName];
  if (!modelSchema) return { valid: false, errors: { _model: `Model "${modelName}" not found` } };

  /** @type {Record<string, string>} */
  const errors = {};

  for (const [field, fieldDef] of Object.entries(modelSchema)) {
    if (field.startsWith("$")) continue;
    const def = /** @type {{ required?: boolean, $type?: string, fieldType?: string, validator?: Function, format?: string, relationship?: string, belongs?: boolean }} */ (fieldDef);
    if (def.relationship && !def.belongs) continue;
    const value = row[field];
    const missing = value === undefined || value === null || value === "";

    if (def.required && missing && options.operation !== "edit") {
      errors[field] = `${field} is required`;
      continue;
    }

    if (value !== undefined && value !== null && def.$type) {
      const isFileBlob = def.fieldType === "file" && value instanceof Blob;
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (!isFileBlob && VALID_TYPES[def.$type] && !VALID_TYPES[def.$type].includes(actualType))
        errors[field] = `${field} must be of type ${def.$type}`;
    }

    if (def.validator && value !== undefined)
      try {
        if (!def.validator(value, row)) errors[field] = `${field} failed custom validation`;
      } catch (e) {
        errors[field] = /** @type {Error} */ (e).message || `${field} validation error`;
      }

    if (def.format && value && FORMATS[def.format] && !FORMATS[def.format].test(/** @type {string} */ (value)))
      errors[field] = `${field} must be a valid ${def.format}`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
