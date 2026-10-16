/**
 * Validation of a value against its descriptor, and of a row against a
 * schema of descriptors: the coercion, the per-type checks, `required`,
 * `format`, a custom validator and the virtual fields a schema interpolates.
 */

import { parse } from "./parse.js";

/** @import { TypeDefinition, ValidationResult, ValidationTuple } from "./types.ts" */

/** @type {Record<string, RegExp>} */
const formats = { email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ };

/**
 * Per-type post-coercion validators. Return `null`/`undefined` when
 * valid, otherwise `[errorCode, details]`.
 *
 * @type {Record<string, (value: unknown, prop: TypeDefinition) => ValidationTuple>}
 */
const validations = {
  datetime: (value, prop) => {
    if (value === null) return prop.required ? ["required", null] : null;
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
      return ["invalid", "invalid datetime"];
    if (prop.min !== undefined && value < new Date(prop.min)) return ["minimum", null];
    if (prop.max !== undefined && value > new Date(prop.max)) return ["maximum", null];
    return null;
  },
  date: (value, prop) => {
    if (value === null) return prop.required ? ["required", null] : null;
    if (!(value instanceof Date) || Number.isNaN(value.getTime()))
      return ["invalid", "invalid date"];
    if (prop.min !== undefined && value < new Date(prop.min)) return ["minimum", null];
    if (prop.max !== undefined && value > new Date(prop.max)) return ["maximum", null];
    return null;
  },
  object: (value, prop) => {
    if (value === null)
      return prop.required ? ["required", null] : ["invalid", "null is not an object"];
    if (typeof value !== "object" || Array.isArray(value))
      return ["invalid", "not an object"];
    return null;
  },
  number: (value, prop) => {
    const n = Number(value);
    if (Number.isNaN(n)) {
      if (!prop.required && (value === null || value === undefined || value === ""))
        return null;
      return ["NaN", null];
    }
    if (prop.min !== undefined && n < prop.min) return ["minimum", null];
    if (prop.max !== undefined && n > prop.max) return ["maximum", null];
    return null;
  },
};

/**
 * Validate a single value against one descriptor.
 *
 * @param {unknown} input
 * @param {TypeDefinition & { key?: string }} prop
 * @param {object} [context]
 * @returns {[string, unknown] | [null, unknown]}
 */
const validateField = (input, prop, context = {}) => {
  let value = input;
  if (value === undefined && prop.defaultValue !== undefined)
    value = prop.defaultValue;

  if (
    prop.required === true &&
    (value === undefined || value === null || value === "")
  )
    return ["required", null];

  if (prop.customValidator) {
    const result = prop.customValidator(value, prop, context);
    if (result) return /** @type {[string, unknown]} */ (result);
  }

  if (prop.relationship) {
    if (prop.many)
      return [
        null,
        Array.isArray(value)
          ? value.map((i) => (prop.mixed ? i : (i?.id ?? i)))
          : [],
      ];
    return [null, /** @type {{ id?: unknown } | null | undefined} */ (value)?.id ?? value];
  }

  let typedValue = parse(value, prop);
  if (
    (value === undefined || value === null || value === "") &&
    prop.defaultValue !== undefined
  )
    typedValue = prop.defaultValue;

  if (
    prop.required === true &&
    (typedValue === undefined || typedValue === null || typedValue === "")
  )
    return ["required", null];

  if (!prop.required && (typedValue === null || typedValue === undefined))
    if (prop.$type === "object" && typedValue === null) {
    } else return [null, typedValue];

  const validation = validations[prop.$type];
  if (validation) {
    const errors = validation(typedValue, prop);
    if (errors) return /** @type {[string, unknown]} */ (errors);
  }

  if (prop.format) {
    const fmt = prop.format;
    const formatFn =
      typeof fmt === "string"
        ? formats[fmt]
        : fmt;

    if (formatFn) {
      const ok =
        typeof formatFn === "function"
          ? formatFn(typedValue)
          : formatFn.test(String(typedValue));
      if (!ok) return ["invalid", `invalid format: ${String(prop.format)}`];
    }
  }

  return [null, typedValue];
};

/**
 * The `validate` every descriptor carries. Uses `this` so one function
 * reference is shared by every descriptor.
 *
 * @this {TypeDefinition}
 * @param {unknown} value
 * @param {object} [context]
 * @returns {ValidationResult}
 */
function typeDefValidate(value, context = {}) {
  const [error, result] = validateField(value, this, context);
  if (error)
    return { valid: false, error, details: result, value };
  return { valid: true, value: result, error: null, details: null };
}

/**
 * Attach `validate` as a non-enumerable own property, so it stays out of
 * `Object.keys`, spreads and `for...in`.
 *
 * @param {object} typeDef
 * @returns {TypeDefinition}
 */
export const attachValidate = (typeDef) => {
  Object.defineProperty(typeDef, "validate", {
    value: typeDefValidate,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return /** @type {TypeDefinition} */ (typeDef);
};

/**
 * @param {string} str
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
const interpolate = (str, data) =>
  str.replace(/\${(.*?)}/g, (_, key) => String(data[key.trim()] ?? ""));

/**
 * Validate an object against a schema of descriptors. Answers
 * `[errors, validatedObject]`, errors `null` on success.
 *
 * @param {Record<string, unknown>} object
 * @param {{
 *   schema: Record<string, TypeDefinition>,
 *   row?: Record<string, unknown>,
 *   undefinedProps?: boolean,
 *   validateVirtual?: boolean,
 *   operation?: string | null,
 * }} options
 * @returns {[Record<string, string> | null, Record<string, unknown> | null]}
 */
export const validateType = (
  object,
  {
    schema,
    row = {},
    undefinedProps = true,
    validateVirtual = false,
    operation = null,
  },
) => {
  if (!schema) return [null, object];
  /** @type {Record<string, string>} */
  const errors = {};
  let hasError = false;

  const context = { operation, row };
  const props = undefinedProps ? schema : object;

  for (const key in props) {
    const prop = { ...schema[key], key };
    if ("virtual" in prop || prop.persist === false) continue;
    const shouldValidate = Boolean(prop.customValidator) || object[key] !== undefined || prop.required === true;

    const [error, value] = shouldValidate
      ? validateField(object[key], prop, context)
      : [null, prop.defaultValue];

    if (error) {
      hasError = true;
      errors[key] = error;
    } else if (value !== undefined) object[key] = value;
  }

  const virtual = Object.fromEntries(
    Object.entries(schema).filter(([_, prop]) => "virtual" in prop),
  );
  for (const prop in virtual)
    if (validateVirtual) {
      const [error, value] = validateField(
        interpolate(/** @type {string} */ (virtual[prop].virtual), { ...row, ...object }),
        virtual[prop],
        context,
      );
      if (error) {
        hasError = true;
        errors[prop] = error;
      } else if (value !== undefined) object[prop] = value;
    } else
      object[prop] = interpolate(/** @type {string} */ (virtual[prop].virtual), { ...row, ...object });

  if (hasError) return [errors, null];
  return [null, object];
};
