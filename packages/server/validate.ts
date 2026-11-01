/**
 * @file A route's middleware for light's model field descriptors: `validate({ params?, query?, body? })`
 * coerces the request's string parameters and query values to the types their descriptors declare,
 * validates the JSON body against its descriptor record, answers 400 with every failure
 * (`{ error: "invalid request", fields: { "query.limit": "must be a number" } }`) and, on success,
 * puts the typed values on the context under `PARAMS`, `QUERY` and `BODY`, each a
 * `Map<string, unknown>` (scriptc refuses a write by a computed string key on a record). The
 * descriptor shape is light's: `{ $type, required, defaultValue, validator, format, relationship,
 * belongs, many, fieldType }`. Supported: the types `string`, `number`, `boolean`, `array` and
 * `object`; `required` (missing is `undefined`, `null` or `""`); optional fields (absent ones are
 * left out, an explicit `null` is kept); `defaultValue` when the value is absent (a function default
 * is called); `validator(value, row)` with light's messages; and the `email` and `url` formats.
 * `min`, `max`, `enum`, `unique`, `immutable` and `maxItems` are carried but not enforced, as
 * `validateRow` does not enforce them either. `date` and `datetime` descriptors pass through
 * unchecked; `relationship` fields that a row does not own (`many`, `one`) are skipped.
 *
 * Query and path values are coerced the way bootstrapp's `coerceParam` does where the two agree:
 * a number through `Number` and a finite check; a boolean from `"true"`, `"false"`, `"1"` or `"0"`
 * (another string is refused); an array from repeated query values (`c.queryAll`) or a comma list
 * (a JSON array is also accepted); an object from JSON. Unknown query and path names are ignored.
 * A body that is not an object is refused, and unknown body keys are kept, as light's model
 * validation keeps them. On a body, numeric and boolean strings are coerced, while an `array` or
 * `object` value must already be an array or an object (only path and query strings are parsed). A
 * malformed JSON body is `c.json()`'s own 400.
 */
import { Context } from "./context.ts";
import { Key } from "./key.ts";
import { Reply, json } from "./reply.ts";
import type { Middleware, Next } from "./router.ts";

/** The typed path parameters a route's `validate` accepted: a field name to its value. */
export const PARAMS = new Key<Map<string, unknown>>("validate.params");

/** The typed query values a route's `validate` accepted: a field name to its value. */
export const QUERY = new Key<Map<string, unknown>>("validate.query");

/** The typed body a route's `validate` accepted: a field name to its value. */
export const BODY = new Key<Map<string, unknown>>("validate.body");

/** One light model field descriptor, as far as this validator reads it. */
export interface FieldDescriptor {
  $type?: string;
  required?: boolean;
  defaultValue?: unknown;
  validator?: unknown;
  format?: unknown;
  relationship?: string;
  belongs?: boolean;
  many?: boolean;
  fieldType?: string;
  [key: string]: unknown;
}

/** A record of field descriptors: a model's schema, or the fields a request carries. */
export type FieldSchema = Record<string, FieldDescriptor>;

/** What a route validates: any of its parameters, its query and its body. */
export interface ValidateSchemas {
  params?: FieldSchema;
  query?: FieldSchema;
  body?: FieldSchema;
}

/** The answer of coercing one value: the typed value, or what is wrong with it. */
class Coerced {
  readonly ok: boolean;
  readonly value: unknown;
  readonly error: string;

  constructor(ok: boolean, value: unknown, error: string) {
    this.ok = ok;
    this.value = value;
    this.error = error;
  }
}

/** A descriptor's custom validator, when it has one. */
type FieldValidator = (value: unknown, row: unknown) => unknown;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL = /^https?:\/\/.+/;

const good = (value: unknown): Coerced => new Coerced(true, value, "");
const bad = (error: string): Coerced => new Coerced(false, undefined, error);

const typeOf = (def: FieldDescriptor): string => (typeof def.$type === "string" ? def.$type : "string");

const parseArray = (text: string): Coerced => {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Array.isArray(parsed) ? good(parsed) : bad("must be an array");
    } catch {
      return bad("must be an array");
    }
  }
  if (trimmed === "") return good([]);
  const parts: string[] = [];
  for (const part of trimmed.split(",")) parts.push(part.trim());
  return good(parts);
};

const coerce = (def: FieldDescriptor, value: unknown, multiple: string[] | null, textual: boolean): Coerced => {
  const type = typeOf(def);
  if (type === "number") {
    if (typeof value === "number") return Number.isFinite(value) ? good(value) : bad("must be a number");
    if (typeof value !== "string") return bad("must be a number");
    const number = Number(value);
    return value !== "" && Number.isFinite(number) ? good(number) : bad("must be a number");
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return good(value);
    if (typeof value === "number" && (value === 1 || value === 0)) return good(value === 1);
    if (typeof value !== "string") return bad("must be a boolean");
    if (value === "true" || value === "1") return good(true);
    if (value === "false" || value === "0") return good(false);
    return bad("must be a boolean");
  }
  if (type === "array") {
    if (multiple !== null && multiple.length > 1) return good(multiple);
    if (multiple !== null && multiple.length === 1) return parseArray(multiple[0]!);
    if (Array.isArray(value)) return good(value);
    if (textual && typeof value === "string") return parseArray(value);
    return bad("must be an array");
  }
  if (type === "object") {
    if (textual && typeof value === "string") {
      try {
        const parsed: unknown = JSON.parse(value);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return bad("must be an object");
        return good(parsed);
      } catch {
        return bad("must be an object");
      }
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) return bad("must be an object");
    return good(value);
  }
  if (type === "string") {
    if (typeof value === "string") return good(value);
    if (typeof value === "number") return good(String(value));
    return bad("must be a string");
  }
  return good(value);
};

const defaultOf = (value: unknown): unknown => (typeof value === "function" ? (value as () => unknown)() : value);

const checkFormat = (def: FieldDescriptor, value: unknown): string => {
  const format = def.format;
  if (typeof format !== "string" || !value) return "";
  if (format === "email") return EMAIL.test(String(value)) ? "" : "must be a valid email";
  if (format === "url") return URL.test(String(value)) ? "" : "must be a valid url";
  return "";
};

const checkValidator = (name: string, def: FieldDescriptor, value: unknown, row: unknown): string => {
  const validator = def.validator;
  if (validator === undefined) return "";
  if (typeof validator !== "function") return name + ".validator is not a function";
  try {
    if (!(validator as FieldValidator)(value, row)) return name + " failed custom validation";
  } catch (e) {
    return e instanceof Error ? e.message : name + " validation error";
  }
  return "";
};

const field = (
  where: string,
  name: string,
  def: FieldDescriptor,
  raw: unknown,
  multiple: string[] | null,
  row: unknown,
  textual: boolean,
  out: Map<string, unknown>,
  errors: Map<string, string>,
): void => {
  const absent = raw === undefined;
  let value = raw;
  if (absent && def.defaultValue !== undefined) value = defaultOf(def.defaultValue);
  if (value === undefined || value === null || value === "") {
    if (def.required === true) {
      errors.set(where + "." + name, "is required");
      return;
    }
    if (!absent && !multiple?.length) out.set(name, value);
    return;
  }
  const checked = value;
  const coerced = coerce(def, value, multiple, textual);
  if (!coerced.ok) {
    errors.set(where + "." + name, coerced.error);
    return;
  }
  value = coerced.value;
  const failed = checkValidator(name, def, textual ? value : checked, row);
  if (failed !== "") {
    errors.set(where + "." + name, failed);
    return;
  }
  const format = checkFormat(def, value);
  if (format !== "") {
    errors.set(where + "." + name, format);
    return;
  }
  out.set(name, value);
};

const accepts = (def: FieldDescriptor): boolean => !(def.relationship && !def.belongs);

const validateQuery = (c: Context, schema: FieldSchema, out: Map<string, unknown>, errors: Map<string, string>): void => {
  for (const name of Object.keys(schema)) {
    const def = schema[name]!;
    if (!accepts(def)) continue;
    const all = c.queryAll(name);
    field("query", name, def, all.length === 0 ? undefined : all[0], all.length === 0 ? null : all, out, true, out, errors);
  }
};

const validateParams = (c: Context, schema: FieldSchema, out: Map<string, unknown>, errors: Map<string, string>): void => {
  for (const name of Object.keys(schema)) {
    const def = schema[name]!;
    if (!accepts(def)) continue;
    const raw = c.param(name);
    field("params", name, def, raw === null ? undefined : raw, null, out, true, out, errors);
  }
};

const validateBody = (body: unknown, schema: FieldSchema, out: Map<string, unknown>, errors: Map<string, string>): void => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    errors.set("body", "must be an object");
    return;
  }
  const record = body as Record<string, unknown>;
  for (const name of Object.keys(record)) out.set(name, record[name]);
  for (const name of Object.keys(schema)) {
    const def = schema[name]!;
    if (!accepts(def)) continue;
    field("body", name, def, record[name], null, record, false, out, errors);
  }
};

/**
 * A route's middleware over light's model field descriptors: `validate({ query: { limit: { $type:
 * "number" } } })` coerces `?limit=10` to `10`, or answers 400 `{ error: "invalid request", fields:
 * { "query.limit": "must be a number" } }`. On success the typed values are on the context under
 * `PARAMS`, `QUERY` and `BODY`.
 */
export const validate = (schemas: ValidateSchemas): Middleware => async (c: Context, next: Next): Promise<Reply> => {
  const params = new Map<string, unknown>();
  const query = new Map<string, unknown>();
  const body = new Map<string, unknown>();
  const errors = new Map<string, string>();
  if (schemas.params !== undefined) validateParams(c, schemas.params, params, errors);
  if (schemas.query !== undefined) validateQuery(c, schemas.query, query, errors);
  if (schemas.body !== undefined) validateBody(await c.json(), schemas.body, body, errors);
  if (errors.size > 0) return json({ error: "invalid request", fields: Object.fromEntries(errors) }, 400);
  if (schemas.params !== undefined) c.set(PARAMS, params);
  if (schemas.query !== undefined) c.set(QUERY, query);
  if (schemas.body !== undefined) c.set(BODY, body);
  return next();
};
