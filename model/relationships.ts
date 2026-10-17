/**
 * @bootstrapp/model: relationship arithmetic shared by the frontend
 * (`include()`, live includes) and the worker-side loader, so both sides
 * agree on the one foreign-key convention: `targetForeignKey`, else
 * `${modelName}Id`.
 */

import type { Row, RelationshipDefinition } from "./types.ts";

export const foreignKeyFor = (modelName: string, rel: RelationshipDefinition): string => rel.targetForeignKey || `${modelName}Id`;

/**
 * The `where` that selects the rows a `many`/`one` relation points at,
 * including the polymorphic `as` form (`{ [as]: id, [asType]: model }`).
 */
export const relationWhere = (modelName: string, row: Row, rel: RelationshipDefinition): Record<string, unknown> => {
  const entries: [string, unknown][] = rel.as ? [[rel.as, row.id], [`${rel.as}Type`, modelName]] : [[foreignKeyFor(modelName, rel), row.id]];
  return Object.fromEntries(entries);
};

/**
 * A `belongs` field holds an id, or the loaded row once included; either
 * way this answers the id.
 */
export const relationValueToId = (value: unknown): unknown =>
  value && typeof value === "object" && "id" in value ? value.id : value;

/**
 * The model a relation resolves to for one row: the declared target, or
 * the row's `<name>Type` column for a polymorphic `belongs`.
 */
export const relationTarget = (row: Row, name: string, rel: RelationshipDefinition): string | undefined =>
  rel.polymorphic && rel.belongs
    ? (row[`${name}Type`] as string | undefined)
    : (rel.targetModel as string);
