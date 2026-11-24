/**
 * @file The build and dev side of a content store: which `content/<model>`
 * folders feed a model whose store's adapter is `content`, the list, row and
 * per-locale files they answer, and the files `light build` writes. A model in
 * another store keeps the `.light/content` seed path instead.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { collect, collectLocales } from "./collect.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const directive = (schema: ModelSchema, name: string): unknown => {
  const record: Record<string, unknown> = schema;
  return record[name];
};

const stringsOf = (value: unknown): string[] => {
  const list: unknown[] = Array.isArray(value) ? value : [];
  return list.filter((entry): entry is string => typeof entry === "string");
};

const appFileOf = (project: string): string | null => {
  const ts = join(project, "src", "app.ts");
  if (existsSync(ts)) return ts;
  const js = join(project, "src", "app.js");
  return existsSync(js) ? js : null;
};

const modelFileOf = (project: string, name: string): string | null => {
  const ts = join(project, "src", "models", `${name}.ts`);
  if (existsSync(ts)) return ts;
  const js = join(project, "src", "models", `${name}.js`);
  return existsSync(js) ? js : null;
};

const schemaOf = async (file: string | null): Promise<ModelSchema | undefined> => {
  if (file === null) return undefined;
  const module = (await import(`${pathToFileURL(file).href}?mtime=${String(Date.now())}`)) as { default?: { schema?: ModelSchema } };
  return module.default?.schema;
};

/** One `content/<model>` folder whose model's store names the `content` adapter. */
export interface ContentModel {
  name: string;
  dir: string;
  schema?: ModelSchema;
  /** The fields the list file leaves out, from the schema's `$heavy`. */
  heavy: string[];
  /** The fields no file carries, from the schema's `$private`. */
  private: string[];
}

const contentFolders = (project: string): Array<{ name: string; dir: string }> => {
  const root = join(project, "content");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => statSync(join(root, name)).isDirectory())
    .sort()
    .map((name) => ({ name, dir: join(root, name) }));
};

/** The content-store models of the project, in folder order; none when it has no app or no such store. */
export const contentModels = async (project: string): Promise<ContentModel[]> => {
  const appFile = appFileOf(project);
  if (appFile === null) return [];
  const module = (await import(`${pathToFileURL(appFile).href}?mtime=${String(Date.now())}`)) as { default?: { stores?: unknown } };
  const config = module.default;
  if (!isRecord(config) || !isRecord(config["stores"])) return [];
  const stores = config["stores"];
  const found: ContentModel[] = [];
  for (const folder of contentFolders(project)) {
    const schema = await schemaOf(modelFileOf(project, folder.name));
    const store = schema !== undefined && typeof schema.$store === "string" ? schema.$store : "main";
    const entry = stores[store];
    const adapter = isRecord(entry) ? entry["adapter"] : undefined;
    if (adapter !== "content") continue;
    const heavy = schema === undefined ? [] : stringsOf(directive(schema, "$heavy"));
    const priv = schema === undefined ? [] : stringsOf(directive(schema, "$private"));
    found.push({ name: folder.name, dir: folder.dir, schema, heavy, private: priv });
  }
  return found;
};

const withId = (row: Record<string, unknown>): Record<string, unknown> => {
  const slug = row["slug"];
  const id = typeof row["id"] === "string" || typeof row["id"] === "number" ? row["id"] : slug;
  return id === undefined ? { ...row } : { id, ...row };
};

const withoutFields = (row: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> => {
  if (fields.length === 0) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) if (!fields.includes(key)) out[key] = row[key];
  return out;
};

const listRows = (model: ContentModel, rows: Record<string, unknown>[]): Record<string, unknown>[] =>
  rows.map((row) => withoutFields(withoutFields(withId(row), model.heavy), model.private));

const rowsFor = (model: ContentModel, locale?: string): Record<string, unknown>[] => {
  if (locale === undefined) return collect(model.dir, { model: model.schema });
  return collectLocales(model.dir, { model: model.schema }).get(locale) ?? collect(model.dir, { model: model.schema });
};

/** A content-store model's list file: every row, `id` filled from `slug`, without heavy or private fields. */
export const contentList = (model: ContentModel, locale?: string): Record<string, unknown>[] => listRows(model, rowsFor(model, locale));

/** The locales a model's folder carries translations for. */
export const contentLocales = (model: ContentModel): string[] => [...collectLocales(model.dir, { model: model.schema }).keys()].sort();

/** One row's whole file, heavy fields included, or null when it has no record. */
export const contentRow = (model: ContentModel, slug: string, locale?: string): Record<string, unknown> | null => {
  const row = rowsFor(model, locale).find((entry) => String(entry["slug"]) === slug);
  return row === undefined ? null : withoutFields(withId(row), model.private);
};

/** Every file a build writes for the project's content store, by their path in the build folder. */
export const contentFiles = async (project: string): Promise<Map<string, string>> => {
  const files = new Map<string, string>();
  for (const model of await contentModels(project)) {
    const rows = collect(model.dir, { model: model.schema });
    files.set(`content/${model.name}.json`, `${JSON.stringify(listRows(model, rows), null, 2)}\n`);
    for (const row of rows) {
      const whole = withoutFields(withId(row), model.private);
      const slug = String(whole["slug"]);
      files.set(`content/${model.name}/${slug}.json`, `${JSON.stringify(whole, null, 2)}\n`);
    }
    for (const [locale, localized] of collectLocales(model.dir, { model: model.schema })) {
      files.set(`content/${model.name}.${locale}.json`, `${JSON.stringify(listRows(model, localized), null, 2)}\n`);
      for (const row of localized) {
        const whole = withoutFields(withId(row), model.private);
        const slug = String(whole["slug"]);
        files.set(`content/${model.name}/${slug}.${locale}.json`, `${JSON.stringify(whole, null, 2)}\n`);
      }
    }
  }
  return files;
};
