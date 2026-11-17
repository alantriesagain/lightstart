/**
 * @file The web host's part of the generation: `.light/main.ts`, which starts
 * the manifest with `@lightstart/app/web`, and, for a project on
 * `@lightstart/components`, the components its views write as
 * `.light/components.ts` and `.light/components.css`. The root view is the
 * page's tag, so the manifest carries no class for it.
 */

import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { GenerationHelpers, HostGeneration, HostPrepared } from "../node/generate.ts";

interface TagEntry {
  module: string;
  style: string | null;
  extends: string | null;
  uses: string[];
}

type TagTable = Record<string, TagEntry>;

const WRITTEN = /<\s*(lc-[a-z0-9-]+)/g;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

/** Whether the project's manifest declares `@lightstart/components`. */
const declaresComponents = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  for (const field of [value["dependencies"], value["devDependencies"]]) {
    if (isRecord(field) && Object.prototype.hasOwnProperty.call(field, "@lightstart/components")) return true;
  }
  return false;
};

/** The tags a `tags.json` value holds, or null when it is not one. */
const tagTable = (value: unknown): TagTable | null => {
  if (!isRecord(value)) return null;
  const table: TagTable = {};
  for (const [tag, entry] of Object.entries(value)) {
    if (!isRecord(entry)) return null;
    const module = entry["module"];
    const style = entry["style"];
    const base = entry["extends"];
    const uses = entry["uses"];
    if (typeof module !== "string") return null;
    if (style !== null && typeof style !== "string") return null;
    if (base !== null && typeof base !== "string") return null;
    if (!Array.isArray(uses)) return null;
    const names: string[] = [];
    for (const use of uses) {
      if (typeof use !== "string") return null;
      names.push(use);
    }
    table[tag] = { module, style, extends: base, uses: names };
  }
  return table;
};

/** The project's tag table: only when it declares the package and its `tags.json` resolves from the project. */
const tableFor = (project: string): TagTable | null => {
  if (!declaresComponents(readJson(join(project, "package.json")))) return null;
  const require = createRequire(join(project, "package.json"));
  let path: string;
  try {
    path = require.resolve("@lightstart/components/tags.json");
  } catch {
    return null;
  }
  return tagTable(readJson(path));
};

/** The project's `src/` TypeScript and JavaScript files, skipping declarations and tests. */
const sources = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") files.push(...sources(path));
    } else if ((entry.name.endsWith(".ts") || entry.name.endsWith(".js")) && !entry.name.endsWith(".d.ts") && !entry.name.includes(".test.")) files.push(path);
  }
  return files.sort();
};

/** The tags the project's sources write, among the table's. */
const writtenTags = (project: string, table: TagTable): string[] => {
  const found = new Set<string>();
  for (const file of sources(join(project, "src"))) {
    for (const match of readFileSync(file, "utf8").matchAll(WRITTEN)) {
      const tag = match[1];
      if (tag !== undefined && Object.prototype.hasOwnProperty.call(table, tag)) found.add(tag);
    }
  }
  return [...found];
};

/** The tags needed: the ones written, their bases and the tags they write, and so on. */
const neededTags = (start: readonly string[], table: TagTable): Set<string> => {
  const needed = new Set<string>();
  const add = (tag: string): void => {
    if (needed.has(tag)) return;
    const entry = table[tag];
    if (entry === undefined) return;
    needed.add(tag);
    if (entry.extends !== null) add(entry.extends);
    for (const use of entry.uses) add(use);
  };
  for (const tag of start) add(tag);
  return needed;
};

const dependenciesOf = (entry: TagEntry): string[] => (entry.extends === null ? entry.uses : [entry.extends, ...entry.uses]);

/** Every base and used tag before the tag that needs it; ties by tag. */
const inOrder = (wanted: ReadonlySet<string>, table: TagTable): string[] => {
  const ordered: string[] = [];
  const done = new Set<string>();
  while (done.size < wanted.size) {
    const ready = [...wanted]
      .filter((tag) => {
        if (done.has(tag)) return false;
        const entry = table[tag];
        return entry === undefined || dependenciesOf(entry).every((dependency) => !wanted.has(dependency) || done.has(dependency));
      })
      .sort();
    const next = ready[0];
    if (next === undefined) throw new Error(`The component tags need each other in a cycle: ${[...wanted].filter((tag) => !done.has(tag)).sort().join(" → ")}`);
    done.add(next);
    ordered.push(next);
  }
  return ordered;
};

/** `lc-app-shell` as the identifier its import is named. */
const identifier = (tag: string): string =>
  tag
    .split("-")
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");

const moduleSource = (order: readonly string[], table: TagTable): string => {
  const lines = ['import View from "@lightstart/light";'];
  for (const tag of order) {
    const entry = table[tag];
    if (entry !== undefined) lines.push(`import ${identifier(tag)} from "@lightstart/components/${entry.module}";`);
  }
  lines.push("");
  for (const tag of order) lines.push(`View.define(${identifier(tag)});`);
  lines.push("");
  return lines.join("\n");
};

const styleSource = (order: readonly string[], table: TagTable): string => {
  const lines = ['@import "../node_modules/@lightstart/light/theme/theme.css";'];
  for (const tag of order) {
    const entry = table[tag];
    if (entry !== undefined && entry.style !== null) lines.push(`@import "../node_modules/@lightstart/components/${entry.style}";`);
  }
  lines.push("");
  return lines.join("\n");
};

const remove = (path: string): boolean => {
  if (!existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
};

/** Write the components files the project needs, remove them when it needs none. */
const writeComponents = (project: string, dir: string, helpers: GenerationHelpers): HostPrepared => {
  const modulePath = join(dir, "components.ts");
  const stylePath = join(dir, "components.css");
  const table = tableFor(project);
  const written = table === null ? [] : writtenTags(project, table);
  const wanted = table === null ? new Set<string>() : neededTags(written, table);
  if (table === null || wanted.size === 0) {
    const found = remove(modulePath);
    const style = remove(stylePath);
    return { changed: found || style, imports: [] };
  }
  const order = inOrder(wanted, table);
  const moduleChanged = helpers.writeWhenChanged(modulePath, moduleSource(order, table));
  const styleChanged = helpers.writeWhenChanged(stylePath, styleSource(order, table));
  return { changed: moduleChanged || styleChanged, imports: ["./components.ts"] };
};

const generation: HostGeneration = {
  rootView: false,
  async prepare(project, dir, helpers) {
    return writeComponents(project, dir, helpers);
  },
  async write(_project, _dir, main, helpers) {
    const source = ['import { start } from "@lightstart/app/web";', 'import manifest from "./app.ts";', "", "await start(manifest);", ""].join("\n");
    return { changed: helpers.writeWhenChanged(main, source), classes: null, modes: [] };
  },
};

export default generation;
