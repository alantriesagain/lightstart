/** @import { WhereClause, QueryOptions, QueryResult, OrderSpec } from "./types.ts" */

/**
 * `"-field"` / `"field"` (comma-separated), `"field DESC"`, or a ready
 * `OrderSpec[]`.
 * @param {string | OrderSpec[] | undefined} order
 * @returns {OrderSpec[]}
 */
export function parseOrder(order) {
  if (!order) return [];
  if (Array.isArray(order)) return order;

  return order.split(",").map(part => {
    const trimmed = part.trim();
    if (trimmed.startsWith("-")) {
      const [field = ""] = trimmed.slice(1).split(/\s+/);
      return { field, direction: /** @type {"DESC"} */ ("DESC") };
    }
    const [field = "", direction = "ASC"] = trimmed.split(/\s+/);
    return { field, direction: /** @type {"ASC" | "DESC"} */ (direction.toUpperCase()) };
  });
}

const ALWAYS_TRUE = () => true;

/**
 * @param {string} operator
 * @param {unknown} expected
 * @param {boolean} [asKey] compare as strings (the `id` field: adapters disagree on its type)
 * @returns {(value: unknown) => boolean}
 */
const compileOperator = (operator, expected, asKey = false) => {
  /** @param {unknown} v */
  const key = (v) => (asKey ? String(v) : v);
  switch (operator) {
    case ">":  return (v) => /** @type {any} */ (v) > /** @type {any} */ (expected);
    case ">=": return (v) => /** @type {any} */ (v) >= /** @type {any} */ (expected);
    case "<":  return (v) => /** @type {any} */ (v) < /** @type {any} */ (expected);
    case "<=": return (v) => /** @type {any} */ (v) <= /** @type {any} */ (expected);
    case "!=":
    case "<>": return (v) => key(v) !== key(expected);
    case "has": {
      const wanted = Array.isArray(expected) ? expected : [expected];
      return (v) => (Array.isArray(v) ? wanted.some((w) => v.includes(w)) : wanted.includes(v));
    }
    case "has all": {
      const wanted = Array.isArray(expected) ? expected : [expected];
      return (v) => Array.isArray(v) && wanted.every((w) => v.includes(w));
    }
    case "in": {
      if (!Array.isArray(expected)) return () => false;
      const set = new Set(expected.map(key));
      return (v) => (Array.isArray(v) ? v.some((entry) => set.has(key(entry))) : set.has(key(v)));
    }
    case "not in": {
      if (!Array.isArray(expected)) return () => false;
      const set = new Set(expected.map(key));
      return (v) => (Array.isArray(v) ? !v.some((entry) => set.has(key(entry))) : !set.has(key(v)));
    }
    case "like":
      return (v) => typeof v === "string" && v.includes(/** @type {string} */ (expected));
    case "ilike": {
      const needle = String(expected).toLowerCase();
      return (v) => typeof v === "string" && v.toLowerCase().includes(needle);
    }
    case "is null":
      return (v) => v === null || v === undefined;
    case "is not null":
      return (v) => v !== null && v !== undefined;
    default:
      return (v) => v === expected;
  }
};

/**
 * @param {string} field
 * @param {unknown} condition
 * @returns {(record: Record<string, unknown>) => boolean}
 */
const compileField = (field, condition) => {
  const asKey = field === "id";
  if (typeof condition !== "object" || condition === null) {
    if (asKey) {
      const target = String(condition);
      return (record) => String(record[field]) === target;
    }
    return (record) => record[field] === condition;
  }

  const operatorChecks = Object.entries(condition).map(([operator, expected]) =>
    compileOperator(operator, expected, asKey),
  );

  return (record) => {
    const value = record[field];
    return operatorChecks.every((check) => check(value));
  };
};

/**
 * Single-shot match: `compileMatcher(where)(record)` in one call.
 *
 * @param {Record<string, unknown>} record
 * @param {WhereClause | undefined} where
 * @returns {boolean}
 */
export function matchesWhere(record, where) {
  return compileMatcher(where)(record);
}

/**
 * Throw if `options` has structurally invalid `limit`/`offset`/`where`/
 * `fields`. Used by adapters that accept user-supplied query options.
 *
 * @param {QueryOptions} [options]
 * @returns {true}
 */
export function validateQueryOptions(options = {}) {
  const { limit, offset, where } = options;

  if (limit !== undefined)
    if (typeof limit !== "number" || limit < 0)
      throw new Error("limit must be a positive number");

  if (offset !== undefined)
    if (typeof offset !== "number" || offset < 0)
      throw new Error("offset must be a non-negative number");

  if (where !== undefined && (typeof where !== "object" || where === null))
    throw new Error("where must be an object");

  if (options.fields !== undefined)
    if (!Array.isArray(options.fields))
      throw new Error("fields must be an array of strings");

  return true;
}

/**
 * Compile a where clause into a fast matcher function. Used by both
 * the in-memory query path and the subscription manager.
 *
 * @param {WhereClause | undefined} where
 * @returns {(record: Record<string, unknown>) => boolean}
 */
export function compileMatcher(where) {
  if (!where || Object.keys(where).length === 0) return ALWAYS_TRUE;

  const fieldChecks = Object.entries(where).map(([field, condition]) =>
    compileField(field, condition),
  );

  return (record) => fieldChecks.every((check) => check(record));
}

/**
 * Slice records by `limit`/`offset`.
 *
 * @template T
 * @param {T[] | null | undefined} records
 * @param {number | undefined} limit
 * @param {number} [offset]
 * @returns {T[]}
 */
export function applyPagination(records, limit, offset = 0) {
  if (!records) return [];
  if (!limit && !offset) return records;

  const start = offset || 0;
  const end = limit ? start + limit : undefined;

  return records.slice(start, end);
}

/**
 * Deduplicate records by `groupField`: first record wins for each
 * value. Records missing the field pass through.
 *
 * @template {Record<string, unknown>} T
 * @param {T[]} records
 * @param {string | undefined} groupField
 * @returns {T[]}
 */
export function applyGroupBy(records, groupField) {
  if (!groupField || !records?.length) return records;

  /** @type {Set<unknown>} */
  const seen = new Set();
  /** @type {T[]} */
  const result = [];

  for (const record of records) {
    const groupKey = record[groupField];

    if (!groupKey) {
      result.push(record);
      continue;
    }

    if (seen.has(groupKey)) continue;
    seen.add(groupKey);
    result.push(record);
  }

  return result;
}

/**
 * Sort records by an order spec (string `"field asc, other desc"` or
 * pre-parsed `OrderSpec[]`).
 *
 * @template {Record<string, unknown>} T
 * @param {T[]} records
 * @param {string | OrderSpec[]} order
 * @returns {T[]}
 */
export function applyOrder(records, order) {
  if (!order || !records || records.length === 0) return records;

  const orderArray = parseOrder(order);
  if (orderArray.length === 0) return records;

  return [...records].sort((a, b) => {
    for (const { field, direction } of orderArray) {
      const aVal = /** @type {any} */ (a[field]);
      const bVal = /** @type {any} */ (b[field]);

      if (aVal === bVal) continue;

      const comparison = aVal < bVal ? -1 : 1;
      return /** @type {string} */ (direction).toUpperCase() === "DESC" ? -comparison : comparison;
    }
    return 0;
  });
}

/**
 * Project records to only the listed fields (plus `id`).
 *
 * @template {Record<string, unknown>} T
 * @param {T[]} records
 * @param {string[]} fields
 * @returns {Record<string, unknown>[]}
 */
export function applyFields(records, fields) {
  if (!fields || fields.length === 0) return records;
  const fieldSet = new Set(fields);
  fieldSet.add("id");
  return records.map((record) => {
    /** @type {Record<string, unknown>} */
    const projected = {};
    for (const key of fieldSet)
      if (key in record) projected[key] = record[key];

    return projected;
  });
}

/**
 * Compose the standard query pipeline: where → order → groupBy →
 * pagination → fields projection. Returns the shape adapters use as
 * their query result.
 *
 * @param {Record<string, unknown>[]} allRecords
 * @param {QueryOptions} [options]
 * @returns {QueryResult}
 */
export function buildQueryResult(allRecords, options = {}) {
  const { where, order, limit, offset, groupBy } = options;

  let filtered = allRecords;
  if (where) {
    const match = compileMatcher(where);
    filtered = allRecords.filter(match);
  }

  if (order)
    filtered = applyOrder(filtered, order);

  if (groupBy)
    filtered = applyGroupBy(filtered, groupBy);

  const total = filtered.length;

  let items = applyPagination(filtered, limit, offset);

  if (options.fields)
    items = applyFields(items, options.fields);

  return {
    items,
    count: total,
    total,
    limit,
    offset: offset || 0,
    groupBy: groupBy || null,
  };
}

export default {
  matchesWhere,
  validateQueryOptions,
  compileMatcher,
  applyOrder,
  applyPagination,
  applyGroupBy,
  applyFields,
  buildQueryResult,
  parseOrder,
};
