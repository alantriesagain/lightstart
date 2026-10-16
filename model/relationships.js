/**
 * @bootstrapp/model: relationship arithmetic shared by the frontend
 * (`include()`, live includes) and the worker-side loader, so both sides
 * agree on the one foreign-key convention: `targetForeignKey`, else
 * `${modelName}Id`.
 */

/** @import { Row, RelationshipDefinition } from "./types.ts" */

/**
 * @param {string} modelName
 * @param {RelationshipDefinition} rel
 */
export const foreignKeyFor = (modelName, rel) => rel.targetForeignKey || `${modelName}Id`;

/**
 * The `where` that selects the rows a `many`/`one` relation points at,
 * including the polymorphic `as` form (`{ [as]: id, [asType]: model }`).
 * @param {string} modelName
 * @param {Row} row
 * @param {RelationshipDefinition} rel
 * @returns {Record<string, unknown>}
 */
export const relationWhere = (modelName, row, rel) =>
  rel.as ? { [rel.as]: row.id, [`${rel.as}Type`]: modelName } : { [foreignKeyFor(modelName, rel)]: row.id };

/**
 * A `belongs` field holds an id, or the loaded row once included; either
 * way this answers the id.
 * @param {unknown} value
 */
export const relationValueToId = (value) =>
  value && typeof value === "object" && "id" in value ? /** @type {{ id: unknown }} */ (value).id : value;

/**
 * The model a relation resolves to for one row: the declared target, or
 * the row's `<name>Type` column for a polymorphic `belongs`.
 * @param {Row} row
 * @param {string} name
 * @param {RelationshipDefinition} rel
 * @returns {string | undefined}
 */
export const relationTarget = (row, name, rel) =>
  rel.polymorphic && rel.belongs
    ? /** @type {string | undefined} */ (row[`${name}Type`])
    : /** @type {string} */ (rel.targetModel);
