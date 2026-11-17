/**
 * @file Reading a model schema as the fields' functions need it: a schema is any object (a light
 * `ModelSchema` with its `$adapter` and hooks, or a plain record), its entries narrowed to field
 * definitions and its `$form` block to the shape this package reads.
 */
import type { ModelFieldDef, ModelFormBlock } from "./types.ts";

/** A schema's entries, by name. */
export const entriesOf = (schema: object): Array<[string, unknown]> => Object.entries(schema as Record<string, unknown>);

/** An entry as a field definition, or null for one that is not an object. */
export const definitionOf = (raw: unknown): ModelFieldDef | null => (typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as ModelFieldDef) : null);

/** The schema's `$form` block, or null when it has none. */
export const formBlockOf = (schema: object): ModelFormBlock | null => {
  const block = (schema as Record<string, unknown>)["$form"];
  return typeof block === "object" && block !== null && !Array.isArray(block) ? (block as ModelFormBlock) : null;
};
