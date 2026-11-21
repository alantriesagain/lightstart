/**
 * @file The generation behind `light app`, `light serve`, `light build` and
 * `light test`: read `src/app.ts` or `src/app.js` and the project's folders,
 * and write `.light/app.ts` (or `.js`) with a static import of every model,
 * controller, view and the routes, plus its manifest, the same for every host;
 * the host's own generation (`@lightstart/app/<host>/generate.ts`) writes
 * `.light/main.ts` (or `.js`) with its start, and any files of its own.
 * The output is sorted (the controllers in the order they start: after the
 * controllers they import) and written only when it changed. A folder with no
 * `src/app.ts` or `src/app.js` is left alone.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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
  /** The language the generated files are written in. */
  extension: ".ts" | ".js";
  models: string[];
  seeds: string[];
  controllers: string[];
  views: string[];
  modes: string[];
  routes: boolean;
  /** Whether a file was written; false when every file already held this content. */
  changed: boolean;
}

/** What a host's generation reaches of the core's: the folder listing, the specifiers, the names and the writes. */
export interface GenerationHelpers {
  /** The language the generated files are written in. */
  readonly extension: ".ts" | ".js";
  /** Whether a store declares `worker: true`, so the host writes its worker entry. */
  readonly worker: boolean;
  /** The app's choices the host's part of the generation reads. */
  readonly info: AppInfo;
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const remove = (path: string): boolean => {
  if (!existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
};

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

/** What reading `src/app.ts` answers: the choices generation and the build's static files need. */
export interface AppInfo {
  host: string;
  root: string;
  locale: string;
  /** The site's address without a trailing slash, or `undefined` when the app names none. */
  url: string | undefined;
  /** Whether any store declares `worker: true`. */
  worker: boolean;
  /** Whether a web store is `indexeddb`, or names no kind (the web default). */
  indexeddb: boolean;
  /** Whether the app runs route changes inside a view transition. */
  transitions: boolean;
  /** Whether the app declares any arguments. */
  args: boolean;
}

/** Read `src/app.ts` without its views: the app module imports only `@lightstart/app`. */
export const infoOf = async (app: string): Promise<AppInfo> => {
  try {
    const module = await import(`${pathToFileURL(app).href}?mtime=${String(Date.now())}`);
    const config = (module as { default?: { host?: unknown; root?: unknown; locale?: unknown; url?: unknown; stores?: unknown; transitions?: unknown; args?: unknown; argsSchema?: unknown } }).default;
    let worker = false;
    let indexeddb = false;
    if (config !== undefined && isRecord(config.stores)) {
      for (const value of Object.values(config.stores)) {
        if (!isRecord(value)) continue;
        if (value["worker"] === true) worker = true;
        const kind = value["kind"];
        if (typeof kind === "function") indexeddb = true;
        else if (kind === undefined || kind === "indexeddb") indexeddb = true;
      }
    }
    return {
      host: config !== undefined && typeof config.host === "string" && config.host.length > 0 ? config.host : "web",
      root: config !== undefined && typeof config.root === "string" ? config.root : "app-root",
      locale: config !== undefined && typeof config.locale === "string" && config.locale.length > 0 ? config.locale : "en",
      url: config !== undefined && typeof config.url === "string" && config.url.length > 0 ? config.url.replace(/\/+$/, "") : undefined,
      worker,
      indexeddb,
      transitions: config !== undefined && config.transitions === true,
      args: config !== undefined && isRecord(config.argsSchema ?? config.args) && Object.keys(config.argsSchema ?? config.args ?? {}).length > 0,
    };
  } catch {
    return { host: "web", root: "app-root", locale: "en", url: undefined, worker: false, indexeddb: false, transitions: false, args: false };
  }
};

/** Read `src/routes.ts` without its views: a route's view is a tag, not an import. */
export const routesOf = async (routes: string): Promise<Record<string, unknown> | null> => {
  try {
    const module = await import(`${pathToFileURL(routes).href}?mtime=${String(Date.now())}`);
    const config = (module as { default?: unknown }).default;
    return isRecord(config) ? config : null;
  } catch {
    return null;
  }
};

const manifestSource = (project: string, app: string, extension: ".ts" | ".js", models: string[], seeds: string[], controllers: string[], views: string[], routes: string | null, rootFile: string | null, appImports: readonly string[]): string => {
  const lines: string[] = [];
  if (extension === ".ts") lines.push('import type { AppManifest } from "@lightstart/app/manifest.ts";');
  lines.push(`import app from "${specifierFor(project, app)}";`);
  models.forEach((file, index) => lines.push(`import model${String(index)} from "${specifierFor(project, file)}";`));
  seeds.forEach((file, index) => lines.push(`import seed${String(index)} from "${specifierFor(project, file)}";`));
  controllers.forEach((file, index) => lines.push(`import controller${String(index)} from "${specifierFor(project, file)}";`));
  if (routes !== null) lines.push(`import routes from "${specifierFor(project, routes)}";`);
  for (const specifier of appImports) lines.push(`import ${JSON.stringify(specifier)};`);
  for (const file of views) {
    if (rootFile !== null && file === rootFile) lines.push(`import rootView from "${specifierFor(project, file)}";`);
    else lines.push(`import "${specifierFor(project, file)}";`);
  }

  lines.push("");
  lines.push(extension === ".ts" ? "const manifest: AppManifest = {" : "const manifest = {");
  lines.push("  app,");
  if (rootFile !== null) lines.push("  rootView,");
  if (models.length === 0) lines.push("  models: [],");
  else {
    lines.push("  models: [");
    models.forEach((file, index) => lines.push(`    { name: ${JSON.stringify(nameOf(file))}, model: model${String(index)} },`));
    lines.push("  ],");
  }
  if (seeds.length === 0) lines.push("  seeds: [],");
  else {
    lines.push("  seeds: [");
    seeds.forEach((_file, index) => lines.push(`    seed${String(index)},`));
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

const declaresI18n = (project: string): boolean => {
  const pkg = readJson(join(project, "package.json"));
  if (!isRecord(pkg)) return false;
  for (const field of [pkg["dependencies"], pkg["devDependencies"]]) {
    if (isRecord(field) && Object.prototype.hasOwnProperty.call(field, "@lightstart/i18n")) return true;
  }
  return false;
};

/** Every dependency the project's manifest names, sorted. */
const dependencyNames = (project: string): string[] => {
  const pkg = readJson(join(project, "package.json"));
  if (!isRecord(pkg)) return [];
  const names = new Set<string>();
  for (const field of [pkg["dependencies"], pkg["devDependencies"]]) {
    if (!isRecord(field)) continue;
    for (const name of Object.keys(field)) names.add(name);
  }
  return [...names].sort();
};

/** The path of a dependency's package.json, resolved from the project, or null when it does not resolve. */
const packageJsonOf = (require: ReturnType<typeof createRequire>, name: string): string | null => {
  try {
    return require.resolve(`${name}/package.json`);
  } catch {
    // A package whose exports hide package.json is found from its entry.
  }
  try {
    let dir = dirname(require.resolve(name));
    while (true) {
      const candidate = join(dir, "package.json");
      if (existsSync(candidate)) return candidate;
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  } catch {
    return null;
  }
};

interface LocalePackage {
  name: string;
  languages: string[];
}

/** The dependencies whose package.json says `light.locales: true`, with the languages they ship, sorted by name. */
const localePackages = (project: string): LocalePackage[] => {
  const require = createRequire(join(project, "package.json"));
  const found: LocalePackage[] = [];
  for (const name of dependencyNames(project)) {
    const path = packageJsonOf(require, name);
    if (path === null) continue;
    const pkg = readJson(path);
    if (!isRecord(pkg) || !isRecord(pkg["light"]) || pkg["light"]["locales"] !== true) continue;
    const dir = join(dirname(path), "locales");
    if (!existsSync(dir)) continue;
    const languages = readdirSync(dir)
      .filter((file) => file.endsWith(".js"))
      .sort();
    if (languages.length > 0) found.push({ name, languages });
  }
  return found;
};

interface LocaleImport {
  language: string;
  alias: string;
}

/**
 * Write `.light/locales.ts`, which imports the language files of every package shipping
 * `light.locales: true` and the project's own `src/locales`, and gives them to
 * `configureI18n` (a package's words first, the project's over them); remove it when the
 * project does not depend on `@lightstart/i18n`.
 */
const writeLocales = (project: string, dir: string, locale: string, helpers: GenerationHelpers): HostPrepared => {
  const extension = helpers.extension;
  const path = join(dir, `locales${extension}`);
  if (!declaresI18n(project)) return { changed: remove(path), imports: [] };

  const imports: string[] = [];
  const fromPackages: LocaleImport[] = [];
  const fromProject: LocaleImport[] = [];
  let count = 0;
  for (const pkg of localePackages(project)) {
    for (const file of pkg.languages) {
      const alias = `locale${String(count)}`;
      count += 1;
      imports.push(`import ${alias} from ${JSON.stringify(`${pkg.name}/locales/${file}`)};`);
      fromPackages.push({ language: file.replace(/\.js$/, ""), alias });
    }
  }
  for (const file of flatFiles(join(project, "src", "locales"))) {
    const alias = `locale${String(count)}`;
    count += 1;
    imports.push(`import ${alias} from ${JSON.stringify(helpers.specifierFor(project, file))};`);
    fromProject.push({ language: nameOf(file), alias });
  }

  const languages = [...new Set([...fromPackages.map((entry) => entry.language), ...fromProject.map((entry) => entry.language)])].sort();
  const dictionaryFor = (language: string): string => {
    const aliases = [
      ...fromPackages.filter((entry) => entry.language === language).map((entry) => entry.alias),
      ...fromProject.filter((entry) => entry.language === language).map((entry) => entry.alias),
    ];
    let expression = "{}";
    for (const alias of aliases) expression = `merge(${expression}, ${alias})`;
    return expression;
  };

  const lines: string[] = ['import { configureI18n } from "@lightstart/i18n";'];
  if (languages.length > 0 && extension === ".ts") lines.push('import type { TranslationTree } from "@lightstart/i18n";');
  lines.push(...imports);
  if (languages.length > 0) {
    lines.push("");
    if (extension === ".ts") {
      lines.push('const isRecord = (value: unknown): value is TranslationTree => typeof value === "object" && value !== null && !Array.isArray(value);');
      lines.push("");
      lines.push("const merge = (base: TranslationTree, over: TranslationTree): TranslationTree => {");
      lines.push("  const merged: TranslationTree = {};");
    } else {
      lines.push('const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);');
      lines.push("");
      lines.push("const merge = (base, over) => {");
      lines.push("  const merged = {};");
    }
    lines.push("  for (const key of Object.keys(base)) merged[key] = base[key];");
    lines.push("  for (const key of Object.keys(over)) {");
    lines.push("    const before = merged[key];");
    lines.push("    const after = over[key];");
    lines.push("    merged[key] = isRecord(before) && isRecord(after) ? merge(before, after) : after;");
    lines.push("  }");
    lines.push("  return merged;");
    lines.push("};");
  }
  lines.push("");
  lines.push("configureI18n({");
  lines.push(`  locales: [${languages.map((language) => JSON.stringify(language)).join(", ")}],`);
  lines.push(`  defaultLocale: ${JSON.stringify(locale)},`);
  if (languages.length === 0) lines.push("  dictionaries: {},");
  else {
    lines.push("  dictionaries: {");
    for (const language of languages) {
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(language) ? language : JSON.stringify(language);
      lines.push(`    ${key}: ${dictionaryFor(language)},`);
    }
    lines.push("  },");
  }
  lines.push("});");
  lines.push("");
  return { changed: helpers.writeWhenChanged(path, lines.join("\n")), imports: [`./locales${extension}`] };
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

/** The app's source path and language; null when there is none, an error when both are there. */
export const appOf = (project: string): { path: string; extension: ".ts" | ".js" } | null => {
  const ts = join(project, "src", "app.ts");
  const js = join(project, "src", "app.js");
  const hasTs = existsSync(ts);
  const hasJs = existsSync(js);
  if (hasTs && hasJs) throw new Error(`The app has both src/app.ts and src/app.js; keep one of them`);
  if (hasJs) return { path: js, extension: ".js" };
  if (hasTs) return { path: ts, extension: ".ts" };
  return null;
};

/** The project's seed files, `src/seed` always and `src/seed.dev` when `dev`; each in the app's language. */
const seedFiles = (project: string, extension: ".ts" | ".js", dev: boolean): string[] => {
  const names = dev ? ["seed", "seed.dev"] : ["seed"];
  return names.map((name) => join(project, "src", `${name}${extension}`)).filter((path) => existsSync(path));
};

/** The project's routes module, `.ts` or `.js`; null when it has none. */
export const routesPathOf = (project: string): string | null => {
  const ts = join(project, "src", "routes.ts");
  if (existsSync(ts)) return ts;
  const js = join(project, "src", "routes.js");
  return existsSync(js) ? js : null;
};

/** What a generation reads: `dev` includes `src/seed.dev` (a release build passes false). */
export interface GenerateOptions {
  /** Whether to read `src/seed.dev` (or `.js`); `true` when absent. */
  dev?: boolean;
}

/** Generate the project's `.light` manifest and entry; null when there is no `src/app.ts` or `src/app.js`. */
export const generate = async (projectPath: string, options: GenerateOptions = {}): Promise<Generated | null> => {
  const project = resolve(projectPath);
  const found = appOf(project);
  if (found === null) return null;
  const app = found.path;

  const models = flatFiles(join(project, "src", "models"));
  const seeds = seedFiles(project, found.extension, options.dev !== false);
  const controllers = inStartOrder(flatFiles(join(project, "src", "controllers")));
  const views = flatFiles(join(project, "src", "views"));
  const routes = routesPathOf(project);

  const info = await infoOf(app);
  const extension = info.host === "tui" ? ".ts" : found.extension;
  const dir = join(project, ".light");
  mkdirSync(dir, { recursive: true });
  const manifest = join(dir, `app${extension}`);
  const main = join(dir, `main${extension}`);
  const part = await hostGeneration(info.host);
  const rootFile = part.rootView ? rootFileOf(views, info.root) : null;
  const helpers = { extension, worker: info.worker, info, flatFiles, specifierFor, nameOf, writeWhenChanged };
  const locales = writeLocales(project, dir, info.locale, helpers);
  const prepared = part.prepare === undefined ? { changed: false, imports: [] } : await part.prepare(project, dir, helpers);
  const appImports = [...locales.imports, ...prepared.imports];
  const wroteManifest = writeWhenChanged(manifest, manifestSource(project, app, extension, models, seeds, controllers, views, routes, rootFile, appImports));
  const written = await part.write(project, dir, main, helpers);

  return {
    dir,
    app,
    manifest,
    main,
    classes: written.classes,
    host: info.host,
    extension,
    models: models.map(nameOf),
    seeds: seeds.map(nameOf),
    controllers: controllers.map(nameOf),
    views: views.map(nameOf),
    modes: written.modes,
    routes: routes !== null,
    changed: wroteManifest || locales.changed || prepared.changed || written.changed,
  };
};
