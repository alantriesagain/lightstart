/**
 * @file The field list for a model that declares no `$form` block: what its schema implies, for a
 * generic editor. A field's own description is read first (`input`, then `cmsType`, then
 * `fieldType`, then `enum` and `relationship`, then the declared type), and only a field nobody
 * described falls through to what its name suggests: `avatar` reads as a url by its name alone, and
 * as a file once the schema says `fieldType: "file"`.
 */
import { definitionOf, entriesOf } from "./schema.ts";
import type { ModelFieldDef, ModelFormField } from "./types.ts";

/** `createdAt` and `user_name` become "Created At" and "User Name". */
export const humanizeName = (name: string): string =>
  name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

/** What a name suggests for a plain string field nobody described; `input`, `fieldType`, `enum` and `relationship` all outrank it. */
export const inputFromName = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes("password")) return "password";
  if (lower.includes("email")) return "email";
  if (lower.includes("url") || lower.includes("link")) return "url";
  if (lower.includes("phone") || lower.includes("tel")) return "tel";
  if (lower.includes("datetime")) return "datetime-local";
  if (lower === "date" || lower.endsWith("date") || lower.endsWith("_at")) return "date";
  if (lower === "time" || lower.endsWith("time")) return "time";
  if (["description", "content", "bio", "body", "text", "summary", "excerpt"].some((word) => lower.includes(word))) return "textarea";
  if (["image", "avatar", "photo", "picture"].some((word) => lower.includes(word))) return "url";
  return "text";
};

/** The control a field definition asks for. */
export const inferInput = (def: ModelFieldDef & { name?: string }): string => {
  if (def.input) return def.input;
  if (def.secret) return "password";
  if (def.cmsType) return def.cmsType;
  if (def.fieldType === "file") return def.$type === "array" ? "files" : "file";
  if (def.fieldType === "files") return "files";
  if (def.enum) return "select";
  if (def.relationship === "belongs") return "select";
  if (def.relationship === "belongs_many") return "multi-select";
  switch ((def.$type ?? "string").toLowerCase()) {
    case "boolean":
      return "checkbox";
    case "number":
      return "number";
    case "array":
    case "object":
      return "textarea";
    default:
      return (def.rows ?? 0) > 1 ? "textarea" : inputFromName(def.name ?? "");
  }
};

/**
 * Every editable field of a model, in schema order. `id` and `updatedAt` are never editable and
 * `createdAt` only when the row exists; a field the store hides (`attribute: false`) is skipped
 * unless a `cmsType` gives it a control, and an `immutable` one is skipped once the row exists.
 */
export const inferFields = (modelSchema?: object, { operation = "add" }: { operation?: "add" | "edit" } = {}): ModelFormField[] => {
  if (modelSchema === undefined) return [];
  const editing = operation === "edit";
  const fields: ModelFormField[] = [];
  for (const [name, raw] of entriesOf(modelSchema)) {
    if (name.startsWith("$") || name.startsWith("_")) continue;
    const def = definitionOf(raw);
    if (def === null) continue;
    if (name === "id" || name === "updatedAt") continue;
    if (name === "createdAt" && !editing) continue;
    if (editing && def.immutable) continue;
    if (def.attribute === false && !def.cmsType) continue;

    const type = inferInput({ ...def, name });
    const field: ModelFormField = { name, label: def.label || humanizeName(name), type, required: !!def.required };
    if (def.placeholder) field.placeholder = def.placeholder;
    if (def.help) field.help = def.help;
    if (def.rows || type === "textarea") field.rows = def.rows || 3;
    if (def.enum) field.options = def.enum.map((value) => ({ value, label: humanizeName(value) }));
    if (def.defaultValue !== undefined) field.defaultValue = def.defaultValue;
    if (def.cmsType) field.cmsType = def.cmsType;
    fields.push(field);
  }
  return fields;
};

/** Which model a `relationship` field's options come from, for a caller that loads them. */
export const relationTargets = (modelSchema: object = {}): Array<{ name: string; model: string }> => {
  const targets: Array<{ name: string; model: string }> = [];
  for (const [name, raw] of entriesOf(modelSchema)) {
    if (name.startsWith("$")) continue;
    const def = definitionOf(raw);
    if (def !== null && def.relationship && def.targetModel) targets.push({ name, model: def.targetModel });
  }
  return targets;
};
