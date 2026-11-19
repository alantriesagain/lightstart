/**
 * @file The row classes the terminal generation writes into `.light/models.ts`:
 * one class per model in `src/models`, its fields typed by the model's schema,
 * and a `static of` that reads a row from outside once and answers `null` for a
 * damaged one. A class is proven native-safe by
 * `packages/light/native/probes/p-am-row-class.rows.ts`.
 */

import { pathToFileURL } from "node:url";

/** One model's file name and schema, as the generation reads them. */
export interface ModelDefinition {
  name: string;
  schema: Record<string, unknown>;
}

type Kind = "string" | "number" | "boolean" | "array" | "object" | "unknown";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isDescriptor = (value: unknown): value is Record<string, unknown> => isRecord(value) && typeof value["$type"] === "string";

/** The class name a model's file name gives it: `task` is `TaskRow`, `note-list` is `NoteListRow`. */
export const classNameOf = (name: string): string => {
  const parts = name.split(/[^A-Za-z0-9]+/).filter((part) => part.length > 0);
  const pascal = parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("");
  return `${pascal.length > 0 ? pascal : "Model"}Row`;
};

const kindOf = (descriptor: Record<string, unknown>): Kind => {
  if (Array.isArray(descriptor["enum"])) return "string";
  switch (descriptor["$type"]) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "unknown";
  }
};

const baseType = (kind: Kind): string => {
  switch (kind) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
};

const checkOf = (kind: Kind, value: string): string | null => {
  switch (kind) {
    case "string":
      return `typeof ${value} !== "string"`;
    case "number":
      return `typeof ${value} !== "number"`;
    case "boolean":
      return `typeof ${value} !== "boolean"`;
    case "array":
      return `!Array.isArray(${value})`;
    case "object":
      return `typeof ${value} !== "object" || ${value} === null || Array.isArray(${value})`;
    default:
      return null;
  }
};

const castFor = (kind: Kind): string => {
  switch (kind) {
    case "array":
      return " as unknown[]";
    case "object":
      return " as Record<string, unknown>";
    default:
      return "";
  }
};

const hasDefault = (descriptor: Record<string, unknown>): boolean => Object.prototype.hasOwnProperty.call(descriptor, "defaultValue") && descriptor["defaultValue"] !== undefined;

const defaultExpression = (kind: Kind, value: unknown): string => {
  if (kind === "array" && Array.isArray(value) && value.length === 0) return "[]";
  if (kind === "object" && isRecord(value) && Object.keys(value).length === 0) return "{}";
  return JSON.stringify(value) ?? "null";
};

interface Field {
  key: string;
  type: string;
  lines: string[];
  value: string;
}

const fieldOf = (key: string, descriptor: Record<string, unknown>, id: boolean): Field => {
  const kind = id ? (descriptor["$type"] === "number" ? "number" : "string") : kindOf(descriptor);
  const required = id || descriptor["required"] === true;
  const fallback = !id && hasDefault(descriptor);
  const defaultValue = descriptor["defaultValue"];
  const nullable = !required && !fallback;
  const missingDefaultIsNull = fallback && defaultValue === null;
  const type = nullable || missingDefaultIsNull ? `${baseType(kind)} | null` : baseType(kind);
  const read = `row.${key}`;
  const local = `${key}Value`;
  const check = checkOf(kind, key);
  const cast = castFor(kind);
  const lines: string[] = [`    const ${key} = ${read};`];
  let value = key;

  if (required && !fallback) {
    if (check !== null) lines.push(`    if (${check}) return null;`);
    if (cast.length > 0) value = `${key}${cast}`;
  } else {
    lines.push(`    let ${local}: ${type} = ${fallback ? defaultExpression(kind, defaultValue) : "null"};`);
    value = local;
    lines.push(`    if (${key} !== undefined) {`);
    if (check !== null) lines.push(`      if (${check}) return null;`);
    lines.push(`      ${value} = ${key}${cast};`);
    lines.push("    }");
  }

  return { key, type, lines, value };
};

const classSource = (definition: ModelDefinition): string => {
  const className = classNameOf(definition.name);
  const fields: Field[] = [];
  const idDescriptor = isDescriptor(definition.schema["id"]) ? definition.schema["id"] : { $type: "string" };
  fields.push(fieldOf("id", idDescriptor, true));
  for (const key of Object.keys(definition.schema)) {
    if (key === "id" || key.startsWith("$")) continue;
    const entry = definition.schema[key];
    if (isDescriptor(entry)) fields.push(fieldOf(key, entry, false));
  }

  const lines: string[] = [];
  lines.push(`/** The ${definition.name} row: its fields typed by the model's schema. */`);
  lines.push(`export class ${className} {`);
  for (const field of fields) lines.push(`  ${field.key}: ${field.type};`);
  lines.push("");
  lines.push(`  constructor(${fields.map((field) => `${field.key}: ${field.type}`).join(", ")}) {`);
  for (const field of fields) lines.push(`    this.${field.key} = ${field.key};`);
  lines.push("  }");
  lines.push("");
  lines.push(`  static of(row: Record<string, unknown>): ${className} | null {`);
  for (const field of fields) lines.push(...field.lines);
  lines.push("");
  lines.push(`    return new ${className}(${fields.map((field) => field.value).join(", ")});`);
  lines.push("  }");
  lines.push("}");
  return lines.join("\n");
};

/** The source of `.light/models.ts` for `models`, sorted by name. */
export const modelsSource = (models: readonly ModelDefinition[]): string => {
  const sorted = [...models].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const lines: string[] = [
    "/**",
    " * @file The row classes of the app's models, generated from their schemas by",
    " * `light app`; never edit it.",
    " */",
    "",
  ];
  sorted.forEach((model, index) => {
    if (index > 0) lines.push("");
    lines.push(classSource(model));
  });
  lines.push("");
  return lines.join("\n");
};

/** Read a model file's `defineModel(...)` schema at generation time. */
export const readModelDefinition = async (file: string, name: string): Promise<ModelDefinition> => {
  const module = (await import(`${pathToFileURL(file).href}?mtime=${String(Date.now())}`)) as { default?: { schema?: unknown } };
  const schema = module.default?.schema;
  if (!isRecord(schema)) throw new Error(`The model src/models/${name}.ts default-exports no schema`);
  return { name, schema };
};
