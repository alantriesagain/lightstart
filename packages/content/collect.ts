/**
 * @file Read a folder of records as a model's rows: a `.md` file's frontmatter fields and body,
 * or a `.json` file's own fields, with the file name filling `slug` when the record has none.
 * `<slug>.<locale>.md`/`.json` beside a record is a translation overlay for the model's
 * `$localized` fields, and the schema's `$private` fields are left out of every row.
 */

import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { validateRow } from "@lightstart/light/model/validate.ts";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { parse } from "@lightstart/markdown";
import { parseFrontmatter } from "./frontmatter.ts";
import { blocksToJson } from "./json.ts";

/** What `collect` reads besides the folder: the model schema the rows are checked against. */
export interface CollectOptions {
  model?: ModelSchema;
}

/** The model name validation reports under; a schema has no name of its own. */
const MODEL_NAME = "content";

/** A language tag as a translation file names it: `pt`, `es` or `pt-BR`. */
const LOCALE = /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/;
const FILE = /^(.*)\.(md|json)$/;

type Extension = "md" | "json";

/** A file name split into its base slug, its optional locale and its extension. */
interface FileName {
  stem: string;
  locale: string | null;
  ext: Extension;
}

interface Source {
  slug: string;
  file: string;
  row: Record<string, unknown>;
}

interface Translation {
  file: string;
  fields: Record<string, unknown>;
}

interface Folder {
  base: Source[];
  translations: Map<string, Map<string, Translation>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const directive = (schema: ModelSchema, name: string): unknown => {
  const record: Record<string, unknown> = schema;
  return record[name];
};

/** A schema's string-list directive, or null when it does not declare one. */
const directiveStrings = (schema: ModelSchema, name: string): string[] | null => {
  const value = directive(schema, name);
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is string => typeof entry === "string");
};

const privateFields = (schema: ModelSchema | undefined): string[] => (schema === undefined ? [] : directiveStrings(schema, "$private") ?? []);

const declaredFields = (schema: ModelSchema): Set<string> => new Set(Object.keys(schema).filter((key) => !key.startsWith("$")));

const checkPrivate = (schema: ModelSchema): void => {
  const declared = declaredFields(schema);
  for (const field of directiveStrings(schema, "$private") ?? []) {
    if (!declared.has(field)) throw new Error(`The model schema's $private names "${field}", which it does not declare`);
  }
};

const withoutPrivate = (row: Record<string, unknown>, privateKeys: readonly string[]): Record<string, unknown> => {
  if (privateKeys.length === 0) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) if (!privateKeys.includes(key)) out[key] = row[key];
  return out;
};

const parseName = (name: string): FileName | null => {
  const match = FILE.exec(name);
  if (match === null) return null;
  const stem = match[1] ?? "";
  const ext: Extension = match[2] === "json" ? "json" : "md";
  const dot = stem.lastIndexOf(".");
  if (dot > 0) {
    const maybe = stem.slice(dot + 1);
    if (LOCALE.test(maybe)) return { stem: stem.slice(0, dot), locale: maybe, ext };
  }
  return { stem, locale: null, ext };
};

const readJson = (path: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(value)) throw new Error(`${basename(path)}: a JSON record must be an object`);
  return { ...value };
};

const readRecord = (path: string, file: FileName): Record<string, unknown> => {
  let row: Record<string, unknown>;
  if (file.ext === "json") row = readJson(path);
  else {
    const parsed = parseFrontmatter(readFileSync(path, "utf8"));
    row = { ...parsed.data, body: blocksToJson(parse(parsed.body)) };
  }
  const slug = typeof row["slug"] === "string" && row["slug"].length > 0 ? row["slug"] : file.stem;
  row["slug"] = slug;
  return row;
};

const readTranslation = (path: string, file: FileName, options: CollectOptions): Record<string, unknown> => {
  let fields: Record<string, unknown>;
  if (file.ext === "json") fields = readJson(path);
  else {
    const parsed = parseFrontmatter(readFileSync(path, "utf8"));
    fields = { ...parsed.data };
    if (parsed.body.trim().length > 0) fields["body"] = blocksToJson(parse(parsed.body));
  }
  delete fields["locale"];
  delete fields["sourceUpdatedAt"];
  if (options.model === undefined) return fields;
  const localized = directiveStrings(options.model, "$localized");
  if (localized === null) return fields;
  const out: Record<string, unknown> = {};
  for (const field of localized) if (field in fields) out[field] = fields[field];
  return out;
};

const checkRow = (row: Record<string, unknown>, options: CollectOptions, file: string): void => {
  if (options.model === undefined) return;
  const result = validateRow({ [MODEL_NAME]: options.model }, MODEL_NAME, row, { operation: "add" });
  const field = Object.keys(result.errors).sort()[0];
  if (field !== undefined) throw new Error(`${file}: field "${field}" ${result.errors[field] ?? "is invalid"}`);
};

const readFolder = (dir: string, options: CollectOptions): Folder => {
  if (options.model !== undefined) checkPrivate(options.model);
  const base: Source[] = [];
  const bySlug = new Map<string, string>();
  const translations = new Map<string, Map<string, Translation>>();
  for (const name of readdirSync(dir).sort()) {
    const file = parseName(name);
    if (file === null) continue;
    const path = join(dir, name);
    if (file.locale === null) {
      const row = readRecord(path, file);
      const slug = String(row["slug"]);
      const previous = bySlug.get(slug);
      if (previous !== undefined) throw new Error(`The content slug "${slug}" is in both "${previous}" and "${name}"`);
      bySlug.set(slug, name);
      base.push({ slug, file: name, row });
      continue;
    }
    let perLocale = translations.get(file.locale);
    if (perLocale === undefined) {
      perLocale = new Map();
      translations.set(file.locale, perLocale);
    }
    const previous = perLocale.get(file.stem);
    if (previous !== undefined) throw new Error(`The translation "${file.stem}.${file.locale}" is in both "${previous.file}" and "${name}"`);
    perLocale.set(file.stem, { file: name, fields: readTranslation(path, file, options) });
  }
  for (const perLocale of translations.values()) {
    for (const [slug, translation] of perLocale) {
      if (!bySlug.has(slug)) throw new Error(`The translation "${translation.file}" has no record "${slug}.md" or "${slug}.json"`);
    }
  }
  return { base, translations };
};

/**
 * One `.md` or `.json` file as a row: its fields, its `body` and a `slug` the file name fills.
 * The schema's `$private` fields are left out of the answer; a row the schema rejects throws.
 */
export const collectFile = (path: string, options: CollectOptions = {}): Record<string, unknown> => {
  const name = basename(path);
  const file = parseName(name);
  if (file === null) throw new Error(`${name}: not a .md or .json file`);
  if (options.model !== undefined) checkPrivate(options.model);
  const row = readRecord(path, file);
  checkRow(row, options, name);
  return withoutPrivate(row, privateFields(options.model));
};

/**
 * Every `.md` or `.json` record in `dir`, sorted by name, as a row. A folder may mix both
 * kinds, and the same `slug` in two files is an error naming both. A row the schema rejects
 * throws, naming the file and the field.
 */
export const collect = (dir: string, options: CollectOptions = {}): Record<string, unknown>[] => {
  const folder = readFolder(dir, options);
  const privateKeys = privateFields(options.model);
  return folder.base.map((source) => {
    checkRow(source.row, options, source.file);
    return withoutPrivate(source.row, privateKeys);
  });
};

/**
 * The folder's records with each locale's translation overlaid, one row list per locale file
 * found. Only the model's `$localized` fields are taken from a translation; `locale` and
 * `sourceUpdatedAt` are metadata. A translation with no record is an error.
 */
export const collectLocales = (dir: string, options: CollectOptions = {}): Map<string, Record<string, unknown>[]> => {
  const folder = readFolder(dir, options);
  const privateKeys = privateFields(options.model);
  const out = new Map<string, Record<string, unknown>[]>();
  for (const [locale, perLocale] of folder.translations) {
    const rows = folder.base.map((source) => {
      const translation = perLocale.get(source.slug);
      const row = translation === undefined ? { ...source.row } : { ...source.row, ...translation.fields };
      checkRow(row, options, translation?.file ?? source.file);
      return withoutPrivate(row, privateKeys);
    });
    out.set(locale, rows);
  }
  return out;
};
