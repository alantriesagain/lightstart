/** @import { TypeOptions, TypeDefinition, TypeExtension, ValidationTuple } from "./types.ts" */

/**
 * Timestamp validator with auto-creation and auto-update semantics.
 * - Auto-creates on `create` operation if value is empty.
 * - Auto-updates on every operation when `update: true`.
 * - Stored as a number (milliseconds since epoch).
 *
 * @param {unknown} value
 * @param {{ update?: boolean, create?: boolean, min?: number, max?: number }} prop
 * @param {{ operation?: string }} [context]
 * @returns {ValidationTuple}
 */
export const timestampValidator = (value, prop, context = {}) => {
  const { operation } = context;
  const currentTime = Date.now();

  if (prop.update === true) return [null, currentTime];

  if (
    operation === "create" &&
    prop.create !== false &&
    (!value || value === "")
  )
    return [null, currentTime];

  if (value) {
    /** @type {number | undefined} */
    let timestamp;

    if (value instanceof Date) timestamp = value.getTime();
    else if (typeof value === "string") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return ["invalid_timestamp", null];
      timestamp = date.getTime();
    } else if (typeof value === "number") timestamp = value;
    else return ["invalid_timestamp", null];

    if (prop.min !== undefined && timestamp < prop.min) return ["minimum", null];
    if (prop.max !== undefined && timestamp > prop.max) return ["maximum", null];

    return [null, timestamp];
  }

  return [null, null];
};

/**
 * Build a `timestamp` type definition. Usage:
 *
 *     T.timestamp()                 // Auto-create on insert only
 *     T.timestamp({ update: true }) // Also auto-update on every save
 *     T.timestamp({ index: true })  // With a DB index
 *
 * @param {TypeOptions & { update?: boolean, create?: boolean }} [options]
 * @returns {TypeDefinition}
 */
const createTimestamp = (options = {}) =>
  /** @type {TypeDefinition} */ ({
    $type: "number",
    persist: true,
    attribute: true,
    index: true,
    timestamp: true,
    ...options,
  });

/** @type {TypeExtension} */
export default {
  types: {
    timestamp: createTimestamp,
  },
};
