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
import { icon } from "@lightstart/light/theme/icons.js";
import type { IconEntry } from "@lightstart/light/theme";
import { workerPathOf } from "../node/generate.ts";
import type { GenerationHelpers, HostGeneration, HostPrepared } from "../node/generate.ts";
import { collectionOf, ownIcons, scanIcons } from "../node/icons.ts";
import type { ScannedIcons } from "../node/icons.ts";
import { scanSync } from "../node/sync.ts";

interface TagEntry {
  module: string;
  style: string | null;
  extends: string | null;
  uses: string[];
  loads: string[];
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
    const loads = entry["loads"] ?? [];
    if (typeof module !== "string") return null;
    if (style !== null && typeof style !== "string") return null;
    if (base !== null && typeof base !== "string") return null;
    if (!Array.isArray(uses) || !Array.isArray(loads)) return null;
    const names: string[] = [];
    for (const use of uses) {
      if (typeof use !== "string") return null;
      names.push(use);
    }
    const later: string[] = [];
    for (const load of loads) {
      if (typeof load !== "string") return null;
      later.push(load);
    }
    table[tag] = { module, style, extends: base, uses: names, loads: later };
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

/** The component source files the tags are written from, resolved from the project; a module that does not resolve is left out. */
const componentSources = (project: string, tags: ReadonlySet<string>, table: TagTable): string[] => {
  const require = createRequire(join(project, "package.json"));
  const files: string[] = [];
  for (const tag of [...tags].sort()) {
    const entry = table[tag];
    if (entry === undefined) continue;
    try {
      const file = require.resolve(`@lightstart/components/${entry.module}`);
      if (!files.includes(file)) files.push(file);
    } catch {
      continue;
    }
  }
  return files;
};

const FRONTMATTER_ICON = /^icon\s*:\s*["']?([a-z][a-z0-9-]*)["']?\s*$/gm;

/** The `content/` Markdown files, whose frontmatter may name an icon (`icon: zap`). */
const markdown = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...markdown(path));
    else if (entry.name.endsWith(".md")) files.push(path);
  }
  return files.sort();
};

/** A Markdown file's frontmatter icons, as the scanner reads a data field. */
const frontmatterIcons = (text: string): string => {
  const end = text.startsWith("---") ? text.indexOf("\n---", 3) : -1;
  if (end < 0) return "";
  return [...text.slice(0, end).matchAll(FRONTMATTER_ICON)].map((match) => `icon: "${match[1] ?? ""}"`).join("\n");
};

/** Every icon the project's own sources and the component modules it uses name. */
const iconScans = (project: string, tags: ReadonlySet<string>, table: TagTable): ScannedIcons[] => {
  const files = [...sources(join(project, "src")), ...componentSources(project, tags, table)];
  const content = markdown(join(project, "content")).map((file) => scanIcons(frontmatterIcons(readFileSync(file, "utf8"))));
  return [...files.map((file) => scanIcons(readFileSync(file, "utf8"))), ...content];
};

interface IconMaskModule {
  iconMaskCSS(icons: Array<{ name: string; entry: IconEntry }>, options?: { solid?: Set<string>; bold?: Set<string> }): string;
  iconSizeCSS(sizes: Iterable<number | string>): string;
}

/** The `.light/icons.css` source for the names found and the app's own icons, or null when there is nothing to draw or the mask module does not resolve. */
const iconsSource = (project: string, scans: readonly ScannedIcons[], set: string): string | null => {
  const names = new Set<string>();
  const solid = new Set<string>();
  const bold = new Set<string>();
  const sizes = new Set<string>();
  const own = ownIcons(project);
  const ownByName = new Map(own.map((item) => [item.name, item.entry]));
  for (const scan of scans) {
    for (const name of scan.names) names.add(name);
    for (const name of scan.solid) solid.add(name);
    for (const name of scan.bold) bold.add(name);
    for (const size of scan.sizes) sizes.add(size);
  }
  for (const name of ownByName.keys()) names.add(name);
  if (names.size === 0) return null;
  const collection = collectionOf(project, set);
  const icons: Array<{ name: string; entry: IconEntry }> = [];
  for (const name of [...names].sort()) {
    const appEntry = ownByName.get(name);
    if (appEntry !== undefined) {
      icons.push({ name, entry: appEntry });
      continue;
    }
    const entry = collection === null ? null : icon(collection, name);
    if (entry !== null) icons.push({ name, entry });
  }
  if (icons.length === 0) return null;
  let mask: IconMaskModule;
  try {
    mask = createRequire(join(project, "package.json"))("@lightstart/components/display/icon-mask.js") as IconMaskModule;
  } catch {
    return null;
  }
  const css = `${mask.iconMaskCSS(icons, { solid, bold })}${mask.iconSizeCSS(sizes)}`;
  return css.length > 0 ? css : null;
};

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

const moduleSource = (order: readonly string[], onDemand: readonly string[], table: TagTable): string => {
  const lines = ['import View from "@lightstart/light";'];
  for (const tag of order) {
    const entry = table[tag];
    if (entry !== undefined) lines.push(`import ${identifier(tag)} from "@lightstart/components/${entry.module}";`);
  }
  if (onDemand.length > 0) lines.push('import { configureOnDemand } from "@lightstart/components/utils/on-demand.js";');
  lines.push("");
  for (const tag of order) lines.push(`View.define(${identifier(tag)});`);
  if (onDemand.length > 0) {
    // One branch per tag, each import typed on its own, in a TypeScript app and a JavaScript one alike.
    lines.push("", "configureOnDemand((tag) => {");
    for (const tag of onDemand) {
      const entry = table[tag];
      if (entry !== undefined) lines.push(`  if (tag === ${JSON.stringify(tag)}) return import("@lightstart/components/${entry.module}").then((module) => View.define(module.default));`);
    }
    lines.push("  return Promise.resolve();", "});");
  }
  lines.push("");
  return lines.join("\n");
};

const styleSource = (order: readonly string[], table: TagTable, icons: boolean): string => {
  const lines = ['@import "../node_modules/@lightstart/light/theme/theme.css";'];
  if (icons) lines.push('@import "./icons.css";');
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
  const extension = helpers.extension;
  const modulePath = join(dir, `components${extension}`);
  const stylePath = join(dir, "components.css");
  const iconPath = join(dir, "icons.css");
  const table = tableFor(project);
  const written = table === null ? [] : writtenTags(project, table);
  const wanted = table === null ? new Set<string>() : neededTags(written, table);
  if (table === null || wanted.size === 0) {
    const found = remove(modulePath);
    const style = remove(stylePath);
    const icons = remove(iconPath);
    return { changed: found || style || icons, imports: [] };
  }
  const order = inOrder(wanted, table);
  const later = new Set<string>();
  for (const tag of wanted) for (const load of table[tag]?.loads ?? []) if (!wanted.has(load)) later.add(load);
  const onDemand = [...later].sort();
  const styled = new Set([...wanted, ...later]);
  const icons = iconsSource(project, iconScans(project, styled, table), helpers.info.icons);
  const iconChanged = icons === null ? remove(iconPath) : helpers.writeWhenChanged(iconPath, icons);
  const moduleChanged = helpers.writeWhenChanged(modulePath, moduleSource(order, onDemand, table));
  const styleChanged = helpers.writeWhenChanged(stylePath, styleSource(inOrder(styled, table), table, icons !== null));
  return { changed: moduleChanged || styleChanged || iconChanged, imports: [`./components${extension}`] };
};

/** Write the sync install the manifest imports before the views, remove it when no source declares a sync. */
const writeSync = (project: string, dir: string, helpers: GenerationHelpers): HostPrepared => {
  const extension = helpers.extension;
  const path = join(dir, `sync${extension}`);
  let sync = false;
  let binder = false;
  for (const file of sources(join(project, "src"))) {
    const scan = scanSync(readFileSync(file, "utf8"));
    sync = sync || scan.sync;
    binder = binder || scan.binder;
  }
  if (!sync) return { changed: remove(path), imports: [] };
  const lines = ['import View from "@lightstart/light";', 'import { syncPlugin } from "@lightstart/light/controller/view";'];
  if (binder) {
    lines.push('import { registerSyncBinder } from "@lightstart/light/controller";');
    lines.push('import { modelBinder } from "@lightstart/light/model/binder";');
  }
  lines.push("", "View.use(syncPlugin);");
  if (binder) lines.push("registerSyncBinder(modelBinder);");
  lines.push("");
  return { changed: helpers.writeWhenChanged(path, lines.join("\n")), imports: [`./sync${extension}`] };
};

const generation: HostGeneration = {
  rootView: false,
  async prepare(project, dir, helpers) {
    const sync = writeSync(project, dir, helpers);
    const components = writeComponents(project, dir, helpers);
    return { changed: sync.changed || components.changed, imports: [...sync.imports, ...components.imports] };
  },
  async write(project, dir, main, helpers) {
    const workerPath = join(dir, "worker.js");
    let changed = false;
    if (helpers.worker) {
      const models = helpers.flatFiles(join(project, "src", "models"));
      const ownWorker = workerPathOf(project);
      const lines = ['import { serveModels } from "@lightstart/app/web/worker-entry";', `import app from "${helpers.specifierFor(project, join(project, "src", `app${helpers.extension}`))}";`];
      models.forEach((file, index) => lines.push(`import model${String(index)} from "${helpers.specifierFor(project, file)}";`));
      if (ownWorker !== null) lines.push(`import worker from "${helpers.specifierFor(project, ownWorker)}";`);
      lines.push("", "serveModels({");
      lines.push("  app,");
      lines.push("  models: {");
      models.forEach((file, index) => lines.push(`    ${JSON.stringify(helpers.nameOf(file))}: model${String(index)},`));
      lines.push("  },");
      if (ownWorker !== null) lines.push("  worker,");
      lines.push("});", "");
      changed = helpers.writeWhenChanged(workerPath, lines.join("\n"));
    } else {
      changed = remove(workerPath);
    }
    const featureImports: string[] = [];
    const options: string[] = [];
    if (!helpers.worker && helpers.info.indexeddb) {
      featureImports.push('import { IndexedDBAdapterType } from "@lightstart/app/web/indexeddb.ts";');
      options.push("adapters: [new IndexedDBAdapterType()],");
    }
    if (helpers.worker) {
      featureImports.push('import { WorkerStores } from "@lightstart/app/web/worker.ts";');
      options.push('stores: new WorkerStores(() => new Worker(new URL("./worker.js", import.meta.url), { type: "module" })),');
    } else {
      featureImports.push('import { LocalStores } from "@lightstart/app/web/local.ts";');
      options.push("stores: new LocalStores(),");
    }
    if (helpers.info.transitions) {
      featureImports.push('import { Transitions } from "@lightstart/app/web/transitions.ts";');
      options.push("transitions: new Transitions(),");
    }
    if (helpers.info.args) {
      featureImports.push('import { queryArgs } from "@lightstart/app/web/args.ts";');
      options.push("args: queryArgs,");
    }
    const lines = ['import { start } from "@lightstart/app/web";', `import manifest from "./app${helpers.extension}";`, ...featureImports, ""];
    if (options.length === 0) lines.push("await start(manifest);");
    else {
      lines.push("await start(manifest, {");
      for (const option of options) lines.push(`  ${option}`);
      lines.push("});");
    }
    lines.push("");
    return { changed: helpers.writeWhenChanged(main, lines.join("\n")) || changed, classes: null, modes: [] };
  },
};

export default generation;
