/**
 * @file The generation behind `light app`, `light serve`, `light build` and
 * `light test`: read `src/app.ts` and the project's folders, and write
 * `.light/app.ts` with a static import of every model, controller, view and
 * the routes, plus its manifest, the same for every host; the host's own
 * generation (`@lightstart/app/<host>/generate.ts`) writes `.light/main.ts`
 * with its start, and any files of its own.
 * The output is sorted (the controllers in the order they start: after the
 * controllers they import) and written only when it changed. A folder with no
 * `src/app.ts` is left alone.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** What one generation found and wrote. */
export interface Generated {
  /** The project's `.light` folder. */
  dir: string;
  /** The app's absolute source path. */
  app: string;
  /** The manifest path. */
  manifest: string;
  /** The entry path. */
  main: string;
  /** The baked class table path, for a terminal host; null on the web. */
  classes: string | null;
  /** The host the entry starts. */
  host: string;
  models: string[];
  controllers: string[];
  views: string[];
  modes: string[];
  routes: boolean;
  /** Whether a file was written; false when every file already held this content. */
  changed: boolean;
}

/** What a host's generation reaches of the core's: the folder listing, the specifiers, the names and the writes. */
export interface GenerationHelpers {
  flatFiles(dir: string): string[];
  specifierFor(from: string, to: string): string;
  nameOf(file: string): string;
  writeWhenChanged(path: string, content: string): boolean;
}

/** What a host's generation wrote: whether a file changed, its baked class table (the terminal's), and the run modes it found. */
export interface HostWritten {
  changed: boolean;
  classes: string | null;
  modes: string[];
}

/** What a host's files for `.light/app.ts` wrote: whether a file changed, and the side-effect imports the manifest adds before the views. */
export interface HostPrepared {
  changed: boolean;
  imports: readonly string[];
}

/** A host's part of the generation: `@lightstart/app/<host>/generate.ts`'s default export. */
export interface HostGeneration {
  /** Whether the manifest carries the root view's class (`rootView`), for a host that makes it. */
  readonly rootView: boolean;
  /** Write the host's files `.light/app.ts` imports, and answer those side-effect imports, before the manifest is written. */
  prepare?(project: string, dir: string, helpers: GenerationHelpers): Promise<HostPrepared>;
  /** Write `.light/main.ts` (`main`) and the host's own files into `dir`. */
  write(project: string, dir: string, main: string, helpers: GenerationHelpers): Promise<HostWritten>;
}

const flatFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".js"))
    .filter((name) => !name.endsWith(".d.ts") && !name.includes(".test."))
    .sort()
    .map((name) => join(dir, name));
};

const nameOf = (file: string): string => basename(file).replace(/\.(ts|js)$/, "");

const IMPORT = /^\s*(import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s*)?["']([^"']+)["']/gm;

/** The controller files `file` imports for their values (an `import type` is not one), among `known`. */
const importedControllers = (file: string, known: ReadonlySet<string>): string[] => {
  const found: string[] = [];
  for (const match of readFileSync(file, "utf8").matchAll(IMPORT)) {
    const specifier = match[3] ?? "";
    if (match[2] !== undefined || !specifier.startsWith(".")) continue;
    const target = resolve(dirname(file), specifier);
    const hit = [target, `${target}.ts`, `${target}.js`].find((candidate) => known.has(candidate));
    if (hit !== undefined && hit !== file && !found.includes(hit)) found.push(hit);
  }
  return found;
};

/**
 * The controllers in the order they start: a controller after every
 * controller it imports, and otherwise by name. A cycle is an error naming it.
 */
const inStartOrder = (controllers: string[]): string[] => {
  const known = new Set(controllers);
  const ordered: string[] = [];
  const visiting: string[] = [];
  const visit = (file: string): void => {
    if (ordered.includes(file)) return;
    const at = visiting.indexOf(file);
    if (at >= 0) {
      const cycle = [...visiting.slice(at), file].map(nameOf).join(" → ");
      throw new Error(`The controllers import each other in a cycle: ${cycle}`);
    }
    visiting.push(file);
    for (const dependency of importedControllers(file, known)) visit(dependency);
    visiting.pop();
    ordered.push(file);
  };
  for (const file of controllers) visit(file);
  return ordered;
};

const specifierFor = (from: string, to: string): string => `../${relative(from, to).split(sep).join("/")}`;

const writeWhenChanged = (path: string, content: string): boolean => {
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (before === content) return false;
  writeFileSync(path, content);
  return true;
};

interface AppInfo {
  host: string;
  root: string;
}

const infoOf = async (app: string): Promise<AppInfo> => {
  try {
    const module = await import(`${pathToFileURL(app).href}?mtime=${String(Date.now())}`);
    const config = (module as { default?: { host?: unknown; root?: unknown } }).default;
    return {
      host: config !== undefined && typeof config.host === "string" && config.host.length > 0 ? config.host : "web",
      root: config !== undefined && typeof config.root === "string" ? config.root : "app-root",
    };
  } catch {
    return { host: "web", root: "app-root" };
  }
};

const manifestSource = (project: string, models: string[], controllers: string[], views: string[], routes: string | null, rootFile: string | null, appImports: readonly string[]): string => {
  const lines: string[] = ['import type { AppManifest } from "@lightstart/app/manifest.ts";'];
  lines.push(`import app from "${specifierFor(project, join(project, "src", "app.ts"))}";`);
  models.forEach((file, index) => lines.push(`import model${String(index)} from "${specifierFor(project, file)}";`));
  controllers.forEach((file, index) => lines.push(`import controller${String(index)} from "${specifierFor(project, file)}";`));
  if (routes !== null) lines.push(`import routes from "${specifierFor(project, routes)}";`);
  for (const specifier of appImports) lines.push(`import ${JSON.stringify(specifier)};`);
  for (const file of views) {
    if (rootFile !== null && file === rootFile) lines.push(`import rootView from "${specifierFor(project, file)}";`);
    else lines.push(`import "${specifierFor(project, file)}";`);
  }

  lines.push("");
  lines.push("const manifest: AppManifest = {");
  lines.push("  app,");
  if (rootFile !== null) lines.push("  rootView,");
  if (models.length === 0) lines.push("  models: [],");
  else {
    lines.push("  models: [");
    models.forEach((file, index) => lines.push(`    { name: ${JSON.stringify(nameOf(file))}, model: model${String(index)} },`));
    lines.push("  ],");
  }
  if (controllers.length === 0) lines.push("  controllers: [],");
  else {
    lines.push("  controllers: [");
    controllers.forEach((file, index) => lines.push(`    { name: ${JSON.stringify(nameOf(file))}, controller: controller${String(index)} },`));
    lines.push("  ],");
  }
  lines.push(`  routes: ${routes === null ? "null" : "routes"},`);
  lines.push(`  views: [${views.map((file) => JSON.stringify(nameOf(file))).join(", ")}],`);
  lines.push("};");
  lines.push("");
  lines.push("export default manifest;");
  lines.push("");
  return lines.join("\n");
};

const rootFileOf = (views: string[], root: string): string => {
  const found = views.find((file) => nameOf(file) === root);
  if (found === undefined) throw new Error(`The app's root view is src/views/${root}.ts, and it is not there`);
  return found;
};

/** The generation of host `host` (`@lightstart/app/<host>/generate.ts`); an error naming it when there is none. */
const hostGeneration = async (host: string): Promise<HostGeneration> => {
  if (!/^[a-z][a-z0-9-]*$/.test(host)) throw new Error(`The app's host "${host}" is not a host's name (web, tui)`);
  let module: unknown;
  try {
    module = await import(`../${host}/generate.ts`);
  } catch {
    throw new Error(`The app's host "${host}" has no generation: @lightstart/app/${host}/generate.ts is not there`);
  }
  const part = (module as { default?: HostGeneration }).default;
  if (part === undefined) throw new Error(`@lightstart/app/${host}/generate.ts default-exports no host generation`);
  return part;
};

/** Generate the project's `.light` manifest and entry; null when there is no `src/app.ts`. */
export const generate = async (projectPath: string): Promise<Generated | null> => {
  const project = resolve(projectPath);
  const app = join(project, "src", "app.ts");
  if (!existsSync(app)) return null;

  const models = flatFiles(join(project, "src", "models"));
  const controllers = inStartOrder(flatFiles(join(project, "src", "controllers")));
  const views = flatFiles(join(project, "src", "views"));
  const routes = existsSync(join(project, "src", "routes.ts")) ? join(project, "src", "routes.ts") : null;

  const dir = join(project, ".light");
  mkdirSync(dir, { recursive: true });
  const manifest = join(dir, "app.ts");
  const main = join(dir, "main.ts");
  const info = await infoOf(app);
  const part = await hostGeneration(info.host);
  const rootFile = part.rootView ? rootFileOf(views, info.root) : null;
  const helpers = { flatFiles, specifierFor, nameOf, writeWhenChanged };
  const prepared = part.prepare === undefined ? { changed: false, imports: [] } : await part.prepare(project, dir, helpers);
  const wroteManifest = writeWhenChanged(manifest, manifestSource(project, models, controllers, views, routes, rootFile, prepared.imports));
  const written = await part.write(project, dir, main, helpers);

  return {
    dir,
    app,
    manifest,
    main,
    classes: written.classes,
    host: info.host,
    models: models.map(nameOf),
    controllers: controllers.map(nameOf),
    views: views.map(nameOf),
    modes: written.modes,
    routes: routes !== null,
    changed: wroteManifest || prepared.changed || written.changed,
  };
};
