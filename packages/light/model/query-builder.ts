import type { WhereClause, QueryOptions, QueryResult, OrderSpec } from "./types.ts";

/**
 * `"-field"` / `"field"` (comma-separated), `"field DESC"`, or a ready
 * `OrderSpec[]`.
 */
export function parseOrder(order: string | OrderSpec[] | undefined): OrderSpec[] {
  if (!order) return [];
  if (Array.isArray(order)) return order;

  return order.split(",").map((part): OrderSpec => {
    const trimmed = part.trim();
    if (trimmed.startsWith("-")) {
      const [field = ""] = trimmed.slice(1).split(/\s+/);
      return { field, direction: "DESC" };
    }
    const [field = "", direction = "ASC"] = trimmed.split(/\s+/);
    return { field, direction: direction.toUpperCase() as "ASC" | "DESC" };
  });
}

const ALWAYS_TRUE = (): boolean => true;

const compileOperator = (operator: string, expected: unknown, asKey = false): ((value: unknown) => boolean) => {
  const key = (v: unknown): unknown => (asKey ? String(v) : v);
  switch (operator) {
    case ">":  return (v) => (v as {}) > (expected as {});
    case ">=": return (v) => (v as {}) >= (expected as {});
    case "<":  return (v) => (v as {}) < (expected as {});
    case "<=": return (v) => (v as {}) <= (expected as {});
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
      return (v) => typeof v === "string" && v.includes(expected as string);
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

const compileField = (field: string, condition: unknown): ((record: Record<string, unknown>) => boolean) => {
  const asKey = field === "id";
  if (typeof condition !== "object" || condition === null) {
    if (asKey) {
      const target = String(condition);
      return (record) => String(record[field]) === target;
    }
    return (record) => record[field] === condition;
  }

  const operatorChecks: Array<(value: unknown) => boolean> = [];
  for (const [operator, expected] of Object.entries(condition as Record<string, unknown>)) operatorChecks.push(compileOperator(operator, expected, asKey));

  return (record) => {
    const value = record[field];
    return operatorChecks.every((check) => check(value));
  };
};

/** Single-shot match: `compileMatcher(where)(record)` in one call. */
export function matchesWhere(record: Record<string, unknown>, where: WhereClause | undefined): boolean {
  return compileMatcher(where)(record);
}

/**
 * Throw if `options` has structurally invalid `limit`/`offset`/`where`/
 * `fields`. Used by adapters that accept user-supplied query options.
 */
export function validateQueryOptions(options: QueryOptions = {}): true {
  const { limit, offset, where } = options;
  const fields: unknown = options.fields;

  if (limit !== undefined)
    if (typeof limit !== "number" || limit < 0)
      throw new Error("limit must be a positive number");

  if (offset !== undefined)
    if (typeof offset !== "number" || offset < 0)
      throw new Error("offset must be a non-negative number");

  if (where !== undefined && (typeof where !== "object" || where === null))
    throw new Error("where must be an object");

  if (fields !== undefined)
    if (!Array.isArray(fields))
      throw new Error("fields must be an array of strings");

  return true;
}

/**
 * Compile a where clause into a fast matcher function. Used by both
 * the in-memory query path and the subscription manager.
 */
export function compileMatcher(where: WhereClause | undefined): (record: Record<string, unknown>) => boolean {
  if (!where || Object.keys(where).length === 0) return ALWAYS_TRUE;

  const fieldChecks: Array<(record: Record<string, unknown>) => boolean> = [];
  for (const [field, condition] of Object.entries(where)) fieldChecks.push(compileField(field, condition));

  return (record) => fieldChecks.every((check) => check(record));
}

/** Slice records by `limit`/`offset`. */
export function applyPagination<T>(records: T[] | null | undefined, limit: number | undefined, offset = 0): T[] {
  if (!records) return [];
  if (!limit && !offset) return records;

  const start = offset || 0;
  const end = limit ? start + limit : undefined;

  return records.slice(start, end);
}

/**
 * Deduplicate records by `groupField`: first record wins for each
 * value. Records missing the field pass through.
 */
export function applyGroupBy<T extends Record<string, unknown>>(records: T[], groupField: string | undefined): T[] {
  if (!groupField || !records?.length) return records;

  const seen: Set<unknown> = new Set();
  const result: T[] = [];

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
 */
export function applyOrder<T extends Record<string, unknown>>(records: T[], order: string | OrderSpec[]): T[] {
  if (!order || !records || records.length === 0) return records;

  const orderArray = parseOrder(order);
  if (orderArray.length === 0) return records;

  return [...records].sort((a, b) => {
    for (const { field, direction } of orderArray) {
      const aVal = a[field] as {};
      const bVal = b[field] as {};

      if (aVal === bVal) continue;

      const comparison = aVal < bVal ? -1 : 1;
      return direction.toUpperCase() === "DESC" ? -comparison : comparison;
    }
    return 0;
  });
}

/** Project records to only the listed fields (plus `id`). */
export function applyFields<T extends Record<string, unknown>>(records: T[], fields: string[]): Record<string, unknown>[] {
  if (!fields || fields.length === 0) return records;
  const fieldSet = new Set(fields);
  fieldSet.add("id");
  return records.map((record) => {
    const projected: Record<string, unknown> = {};
    for (const key of fieldSet)
      if (key in record) projected[key] = record[key];

    return projected;
  });
}

/**
 * Compose the standard query pipeline: where → order → groupBy →
 * pagination → fields projection. Returns the shape adapters use as
 * their query result.
 */
export function buildQueryResult(allRecords: Record<string, unknown>[], options: QueryOptions = {}): QueryResult {
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
  applyOrder: (records: Record<string, unknown>[], order: string | OrderSpec[]) => applyOrder(records, order),
  applyPagination: (records: Record<string, unknown>[] | null | undefined, limit: number | undefined, offset = 0) => applyPagination(records, limit, offset),
  applyGroupBy: (records: Record<string, unknown>[], groupField: string | undefined) => applyGroupBy(records, groupField),
  applyFields: (records: Record<string, unknown>[], fields: string[]) => applyFields(records, fields),
  buildQueryResult,
  parseOrder,
};
