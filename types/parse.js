/**
 * Coercion of what an attribute, an input or a stored row holds into a
 * descriptor's declared type.
 */

/** @import { Parser, PropertyDeclaration, TypeDefinition } from "./types.ts" */

/** @type {Record<string, null | undefined>} */
const specialCases = { undefined: undefined, null: null, "": null };

/** @param {string} value */
const parseJSON = (value) => {
  try {
    return value in specialCases ? value : JSON.parse(value);
  } catch (_) {
    return undefined;
  }
};

/**
 * Whether a value in a `props` block is a descriptor (what `T.*()`
 * returns, or any object carrying `$type`) rather than a default.
 * @param {unknown} value
 * @returns {value is TypeDefinition}
 */
export const isDescriptor = (value) => value !== null && typeof value === "object" && "$type" in value;

/**
 * The default a `props` entry declares: a descriptor's `defaultValue`, or the
 * value standing in for one.
 * @param {PropertyDeclaration} value
 */
const defaultOf = (value) => (isDescriptor(value) ? value.defaultValue : value);

/** @param {unknown} value */
const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(/** @type {string | number} */ (value));
};

/**
 * Coercion per type, from what an attribute or an input holds to the declared
 * type. A host adds its own types here (`parsers.money = ...`).
 * @type {Record<string, Parser>}
 */
export const parsers = {
  any: (value) => value,
  function: (value) => value,
  boolean: (value, prop) =>
    ((prop?.attribute ?? true) && value === "") || ["true", 1, "1", true].includes(/** @type {string | number | boolean} */ (value)),
  string: (value) => {
    const key = String(value);
    return key in specialCases ? specialCases[key] : key;
  },
  number: (value) => (value === null || value === undefined || value === "" ? value : Number(value)),
  date: toDate,
  datetime: toDate,
  array: (value, prop) => {
    if (Array.isArray(value)) return value;
    const parsed = typeof value === "string" ? parseJSON(value) : value;
    if (!value || !Array.isArray(parsed)) return [];
    const itemType = /** @type {Record<string, TypeDefinition> | undefined} */ (prop?.itemType);
    if (!itemType || isDescriptor(itemType)) return parsed;
    return parsed.map((item) =>
      typeof item !== "object" || item === null
        ? item
        : Object.fromEntries(
            Object.entries(item).map(([key, val]) => {
              const parser = itemType[key] && parsers[itemType[key].$type];
              return [key, parser ? parser(val, prop) : val];
            }),
          ),
    );
  },
  object: (input, prop) => {
    if (input === null) return null;
    const value = typeof input === "string" ? parseJSON(input) : input;
    if (prop?.props && value && typeof value === "object") {
      const target = /** @type {Record<string, unknown>} */ (value);
      for (const [key, def] of Object.entries(prop.props)) {
        const defaultValue = defaultOf(def);
        if (defaultValue !== undefined && target[key] === undefined) target[key] = defaultValue;
      }
    }
    return value;
  },
};

/**
 * `value` coerced to `prop.$type`; a type without a parser passes through.
 * @param {unknown} value
 * @param {TypeDefinition} [prop]
 * @returns {unknown}
 */
export const parse = (value, prop) => {
  const parser = prop && parsers[prop.$type];
  return parser ? parser(value, prop) : value;
};
