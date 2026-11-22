/**
 * @file The build and dev side of a content store: which `content/<model>`
 * folders feed a model whose store's adapter is `content`, the list and row
 * files they answer, and the files `light build` writes. A model in another
 * store keeps the `.light/content` seed path instead.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { collect, collectFile } from "./collect.ts";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

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
    const heavy = schema !== undefined && Array.isArray(schema.$heavy) ? schema.$heavy.filter((field): field is string => typeof field === "string") : [];
    found.push({ name: folder.name, dir: folder.dir, schema, heavy });
  }
  return found;
};

const withId = (row: Record<string, unknown>): Record<string, unknown> => {
  const slug = row["slug"];
  const id = typeof row["id"] === "string" || typeof row["id"] === "number" ? row["id"] : slug;
  return id === undefined ? { ...row } : { id, ...row };
};

const withoutHeavy = (row: Record<string, unknown>, heavy: readonly string[]): Record<string, unknown> => {
  if (heavy.length === 0) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) if (!heavy.includes(key)) out[key] = row[key];
  return out;
};

/** A content-store model's list file: every row, `id` filled from `slug`, without its heavy fields. */
export const contentList = (model: ContentModel): Record<string, unknown>[] => collect(model.dir, { model: model.schema }).map((row) => withoutHeavy(withId(row), model.heavy));

/** One row's whole file, heavy fields included, or null when its Markdown file is not there. */
export const contentRow = (model: ContentModel, slug: string): Record<string, unknown> | null => {
  const path = join(model.dir, `${slug}.md`);
  if (!existsSync(path)) return null;
  return withId(collectFile(path, { model: model.schema }));
};

/** Every file a build writes for the project's content store, by their path in the build folder. */
export const contentFiles = async (project: string): Promise<Map<string, string>> => {
  const files = new Map<string, string>();
  for (const model of await contentModels(project)) {
    files.set(`content/${model.name}.json`, `${JSON.stringify(contentList(model), null, 2)}\n`);
    for (const row of collect(model.dir, { model: model.schema })) {
      const whole = withId(row);
      const slug = String(whole["slug"]);
      files.set(`content/${model.name}/${slug}.json`, `${JSON.stringify(whole, null, 2)}\n`);
    }
  }
  return files;
};
