/**
 * @file Dynamic data as the core reads it: a value narrowed to a record, a string or a number with a
 * fallback, an error's message, and JSON written as text (natively an object filled by computed
 * string keys slows every call, so the core writes its JSON objects and lists as text).
 */

/** Whether `v` is a record: an object, not null, not an array. */
export const isRecord = (v: unknown): boolean => typeof v === "object" && v !== null && !Array.isArray(v);

/** `v` as a record, or null. */
export const recordOf = (v: unknown): Record<string, unknown> | null => (isRecord(v) ? (v as Record<string, unknown>) : null);

/** `v` when it is a string, else `fallback`. */
export const text = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

/** `v` when it is a string, else "". */
export const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The strings in `v` that are strings, else []. */
export const strs = (v: unknown): string[] => {
  const out: string[] = [];
  if (Array.isArray(v)) for (const s of v as unknown[]) if (typeof s === "string") out.push(s);
  return out;
};

/** `v` when it is an array, else []. */
export const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);

/** `text` parsed as JSON, or null when it is not. */
export const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** `v` when it is a number, else `fallback`. */
export const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

/** An error's message, or `fallback` for a throw that is not an Error. */
export const errorMessage = (err: unknown, fallback: string): string => (err instanceof Error ? err.message : fallback);

/** A JSON object as text: `keys` and their `values`, each already JSON text. */
export const objectText = (keys: string[], values: string[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < keys.length; i++) parts.push(JSON.stringify(keys[i]) + ":" + values[i]);
  return "{" + parts.join(",") + "}";
};

/** A JSON list as text: `items`, each already JSON text. */
export const listText = (items: string[]): string => "[" + items.join(",") + "]";
