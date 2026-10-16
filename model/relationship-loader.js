/**
 * Eager loading of `includes` on the worker side. Reads go through a reader
 * (the store) so every adapter, remote or local, answers the same shape and
 * the loaded rows are plain objects.
 */

import { modelBus } from "./config.js";
import { MODEL_ERROR, MODEL_WARN } from "./events.js";
import { relationValueToId, relationWhere } from "./relationships.js";

/** @import { ModelSchema, Row, RelationshipDefinition, RowReader } from "./types.ts" */

/**
 * Enrich `record` with the relations listed in `includes`. An unknown name
 * warns and is skipped; a failed load emits `MODEL_ERROR` and leaves `[]` or
 * `null` per the relation's cardinality.
 *
 * @param {RowReader} reader
 * @param {Record<string, ModelSchema>} models
 * @param {string} modelName
 * @param {Row} record
 * @param {string[]} includes
 * @returns {Promise<Row>}
 */
export async function loadRelationships(reader, models, modelName, record, includes) {
  if (!includes || includes.length === 0 || !record) return record;

  const modelSchema = models[modelName];
  if (!modelSchema) {
    modelBus().emit(MODEL_WARN, { type: "model_not_found", model: modelName });
    return record;
  }

  /** @type {Row} */
  const enriched = Object.fromEntries(Object.entries(record));

  for (const relationName of includes) {
    const relationDef = /** @type {RelationshipDefinition | undefined} */ (modelSchema[relationName]);

    if (!relationDef) {
      modelBus().emit(MODEL_WARN, { type: "relationship_not_found", model: modelName, relationship: relationName });
      continue;
    }

    if (!relationDef.relationship) {
      modelBus().emit(MODEL_WARN, { type: "not_a_relationship", model: modelName, field: relationName });
      continue;
    }

    try {
      enriched[relationName] = await loadRelationship(reader, models, modelName, record, relationName, relationDef);
    } catch (error) {
      modelBus().emit(MODEL_ERROR, { type: "relationship_load_failed", model: modelName, relationship: relationName, error });
      enriched[relationName] = relationDef.many ? [] : null;
    }
  }

  return enriched;
}

/**
 * Batch version of `loadRelationships`: a polymorphic `belongs` is resolved
 * with one query per target type instead of one per row.
 *
 * @param {RowReader} reader
 * @param {Record<string, ModelSchema>} models
 * @param {string} modelName
 * @param {Row[]} records
 * @param {string[]} includes
 * @returns {Promise<Row[]>}
 */
export async function loadRelationshipsForMany(reader, models, modelName, records, includes) {
  if (!includes || includes.length === 0 || !records || records.length === 0) return records;

  const modelSchema = models[modelName];
  if (!modelSchema) return records;

  /** @type {string[]} */
  const polymorphicIncludes = [];
  /** @type {string[]} */
  const regularIncludes = [];

  for (const relationName of includes) {
    const relationDef = /** @type {RelationshipDefinition | undefined} */ (modelSchema[relationName]);
    if (relationDef?.polymorphic && relationDef?.relationship === "belongs") polymorphicIncludes.push(relationName);
    else regularIncludes.push(relationName);
  }

  /** @type {Row[]} */
  let enriched = records.map((r) => ({ ...r }));

  if (regularIncludes.length > 0)
    enriched = await Promise.all(enriched.map((record) => loadRelationships(reader, models, modelName, record, regularIncludes)));

  for (const relationName of polymorphicIncludes) {
    const typeFieldName = `${relationName}Type`;

    /** @type {Record<string, Map<string, Row[]>>} */
    const byType = {};
    for (const record of enriched) {
      const contentType = /** @type {string | undefined} */ (record[typeFieldName]);
      const contentId = relationValueToId(record[relationName]);
      record[relationName] = null;
      if (!contentType || !contentId || !models[contentType]) continue;
      let holders = byType[contentType];
      if (!holders) {
        holders = new Map();
        byType[contentType] = holders;
      }
      const key = String(contentId);
      holders.set(key, [...(holders.get(key) ?? []), record]);
    }

    await Promise.all(
      Object.entries(byType).map(async ([type, holders]) => {
        const related = await reader.getAll(type, { where: { id: { in: [...holders.keys()] } } });
        for (const row of related)
          for (const record of holders.get(String(row.id)) ?? []) record[relationName] = row;
      }),
    );
  }

  return enriched;
}

/**
 * @param {RowReader} reader
 * @param {Record<string, ModelSchema>} models
 * @param {string} modelName
 * @param {Row} record
 * @param {string} relationName
 * @param {RelationshipDefinition} relationDef
 * @returns {Promise<Row | Row[] | null>}
 */
async function loadRelationship(reader, models, modelName, record, relationName, relationDef) {
  const { relationship, targetModel, many, polymorphic } = relationDef;

  if (relationship === "belongs" && polymorphic) {
    const foreignKeyValue = relationValueToId(record[relationName]);
    if (!foreignKeyValue) return null;

    const typeFieldName = `${relationName}Type`;
    const contentType = /** @type {string | undefined} */ (record[typeFieldName]);

    if (!contentType) {
      modelBus().emit(MODEL_WARN, { type: "polymorphic_type_missing", model: modelName, field: relationName, typeField: typeFieldName });
      return null;
    }

    if (!models[contentType]) {
      modelBus().emit(MODEL_WARN, { type: "polymorphic_model_not_found", model: modelName, field: relationName, targetModel: contentType });
      return null;
    }

    return reader.get(contentType, /** @type {string | number} */ (foreignKeyValue));
  }

  const target = /** @type {string} */ (targetModel);

  if (relationship === "belongs") {
    const foreignKeyValue = relationValueToId(record[relationName]);
    if (!foreignKeyValue) return null;
    return reader.get(target, /** @type {string | number} */ (foreignKeyValue));
  }

  if (relationship === "belongs_many") {
    const foreignKeyValues = record[relationName];
    if (!Array.isArray(foreignKeyValues) || foreignKeyValues.length === 0) return [];
    return reader.getAll(target, { where: { id: { in: foreignKeyValues.map(relationValueToId) } } });
  }

  if (relationship === "many")
    return reader.getAll(target, { where: relationWhere(modelName, record, relationDef) });

  if (relationship === "one") {
    const related = await reader.getAll(target, { where: relationWhere(modelName, record, relationDef), limit: 1 });
    return related[0] ?? null;
  }

  modelBus().emit(MODEL_WARN, { type: "unknown_relationship_type", relationship });
  return many ? [] : null;
}
