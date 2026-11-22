/**
 * @file Read a folder of Markdown files as a model's rows: each file's frontmatter fields, its
 * body as plain JSON blocks, and the file name without `.md` as `slug` when the frontmatter has
 * none. Given the model's schema, a row its fields reject is an error naming the file and field.
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

/** One Markdown file as a row: its frontmatter fields, its `body` and a `slug` the file name fills. */
export const collectFile = (path: string, options: CollectOptions = {}): Record<string, unknown> => {
  const name = basename(path);
  const parsed = parseFrontmatter(readFileSync(path, "utf8"));
  const slug = typeof parsed.data["slug"] === "string" && parsed.data["slug"].length > 0 ? parsed.data["slug"] : basename(name, ".md");
  const row: Record<string, unknown> = { ...parsed.data, slug, body: blocksToJson(parse(parsed.body)) };

  if (options.model !== undefined) {
    const result = validateRow({ [MODEL_NAME]: options.model }, MODEL_NAME, row, { operation: "add" });
    const field = Object.keys(result.errors).sort()[0];
    if (field !== undefined) throw new Error(`${name}: field "${field}" ${result.errors[field] ?? "is invalid"}`);
  }
  return row;
};

/**
 * Every `.md` file in `dir`, sorted by name, as a row: its frontmatter fields, its `body` and
 * a `slug` the file name fills. A row the schema rejects throws, naming the file and the field.
 */
export const collect = (dir: string, options: CollectOptions = {}): Record<string, unknown>[] => {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  return files.map((name) => collectFile(join(dir, name), options));
};
