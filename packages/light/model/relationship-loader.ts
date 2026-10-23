/**
 * Eager loading of `includes` on the worker side. Reads go through a reader
 * (the store) so every adapter, remote or local, answers the same shape and
 * the loaded rows are plain objects.
 */

import { modelBus } from "./config.ts";
import { MODEL_ERROR, MODEL_WARN } from "./events.ts";
import { relationValueToId, relationWhere } from "./relationships.ts";
import { entryOf, schemaEntry } from "./fields.ts";

import type { ModelSchema, Row, RelationshipDefinition, RowReader } from "./types.ts";

/**
 * Enrich `record` with the relations listed in `includes`. An unknown name
 * warns and is skipped; a failed load emits `MODEL_ERROR` and leaves `[]` or
 * `null` per the relation's cardinality.
 */
export async function loadRelationships(reader: RowReader, models: Record<string, ModelSchema>, modelName: string, record: Row, includes: string[]): Promise<Row> {
  if (includes.length === 0) return record;

  const modelSchema = entryOf(models, modelName);
  if (!modelSchema) {
    modelBus().emit(MODEL_WARN, { type: "model_not_found", model: modelName });
    return record;
  }

  const loaded: [string, unknown][] = [];

  for (const relationName of includes) {
    const relationDef = schemaEntry(modelSchema, relationName) as RelationshipDefinition | undefined;

    if (!relationDef) {
      modelBus().emit(MODEL_WARN, { type: "relationship_not_found", model: modelName, relationship: relationName });
      continue;
    }

    if (!relationDef.relationship) {
      modelBus().emit(MODEL_WARN, { type: "not_a_relationship", model: modelName, field: relationName });
      continue;
    }

    try {
      loaded.push([relationName, await loadRelationship(reader, models, modelName, record, relationName, relationDef)]);
    } catch (error) {
      modelBus().emit(MODEL_ERROR, { type: "relationship_load_failed", model: modelName, relationship: relationName, error });
      loaded.push([relationName, relationDef.many ? [] : null]);
    }
  }

  return Object.fromEntries([...Object.entries(record), ...loaded]);
}

/**
 * Batch version of `loadRelationships`: a polymorphic `belongs` is resolved
 * with one query per target type instead of one per row.
 */
export async function loadRelationshipsForMany(reader: RowReader, models: Record<string, ModelSchema>, modelName: string, records: Row[], includes: string[]): Promise<Row[]> {
  if (!includes || includes.length === 0 || !records || records.length === 0) return records;

  const modelSchema = entryOf(models, modelName);
  if (!modelSchema) return records;

  const polymorphicIncludes: string[] = [];
  const regularIncludes: string[] = [];

  for (const relationName of includes) {
    const relationDef = schemaEntry(modelSchema, relationName) as RelationshipDefinition | undefined;
    if (relationDef?.polymorphic && relationDef?.relationship === "belongs") polymorphicIncludes.push(relationName);
    else regularIncludes.push(relationName);
  }

  let enriched: Row[] = records.map((r): Row => Object.fromEntries(Object.entries(r)));

  if (regularIncludes.length > 0) {
    const loads: Promise<Row>[] = [];
    for (const record of enriched) loads.push(loadRelationships(reader, models, modelName, record, regularIncludes));
    enriched = await Promise.all(loads);
  }

  for (const relationName of polymorphicIncludes) {
    const typeFieldName = `${relationName}Type`;
    const found: (Row | null)[] = enriched.map(() => null);
    const byType = new Map<string, Map<string, number[]>>();
    for (let i = 0; i < enriched.length; i++) {
      const record = enriched[i];
      const contentType = record[typeFieldName] as string | undefined;
      const contentId = relationValueToId(record[relationName]);
      if (!contentType || !contentId || !entryOf(models, contentType)) continue;
      let holders = byType.get(contentType);
      if (holders === undefined) {
        holders = new Map<string, number[]>();
        byType.set(contentType, holders);
      }
      const key = String(contentId);
      const at = holders.get(key);
      if (at === undefined) holders.set(key, [i]);
      else at.push(i);
    }

    await Promise.all(
      [...byType.entries()].map(async ([type, holders]) => {
        const related = await reader.getAll(type, { where: { id: { in: [...holders.keys()] } } });
        for (const row of related) for (const i of holders.get(String(row.id)) ?? []) found[i] = row;
      }),
    );

    enriched = enriched.map((record, i): Row => {
      const hit: [string, unknown] = [relationName, found[i]];
      return Object.fromEntries([...Object.entries(record), hit]);
    });
  }

  return enriched;
}

async function loadRelationship(reader: RowReader, models: Record<string, ModelSchema>, modelName: string, record: Row, relationName: string, relationDef: RelationshipDefinition): Promise<Row | Row[] | null> {
  const { relationship, targetModel, many, polymorphic } = relationDef;

  if (relationship === "belongs" && polymorphic) {
    const foreignKeyValue = relationValueToId(record[relationName]);
    if (!foreignKeyValue) return null;

    const typeFieldName = `${relationName}Type`;
    const contentType = record[typeFieldName] as string | undefined;

    if (!contentType) {
      modelBus().emit(MODEL_WARN, { type: "polymorphic_type_missing", model: modelName, field: relationName, typeField: typeFieldName });
      return null;
    }

    if (!entryOf(models, contentType)) {
      modelBus().emit(MODEL_WARN, { type: "polymorphic_model_not_found", model: modelName, field: relationName, targetModel: contentType });
      return null;
    }

    return reader.get(contentType, foreignKeyValue as string | number);
  }

  const target = targetModel as string;

  if (relationship === "belongs") {
    const foreignKeyValue = relationValueToId(record[relationName]);
    if (!foreignKeyValue) return null;
    return reader.get(target, foreignKeyValue as string | number);
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

  modelBus().emit(MODEL_WARN, { type: "unknown_relationship_type", relationship: relationDef.relationship });
  const none: Row[] = [];
  return many ? none : null;
}
