/**
 * @file The generation behind `light app`, `light serve`, `light build` and
 * `light test`: read `src/app.ts` and the project's folders, and write
 * `.light/app.ts` with a static import of every model, controller, view and
 * the routes, plus its manifest, and `.light/main.ts` with the host's start.
 * The output is sorted (the controllers in the order they start: after the
 * controllers they import) and written only when it changed. A folder with no
 * `src/app.ts` is left alone.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { bakeTables, collectClasses, render as renderClasses } from "@lightstart/light/theme/bake.js";
import defaultTheme from "@lightstart/light/theme/themes/default.js";

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
      host: config !== undefined && config.host === "tui" ? "tui" : "web",
      root: config !== undefined && typeof config.root === "string" ? config.root : "app-root",
    };
  } catch {
    return { host: "web", root: "app-root" };
  }
};

const manifestSource = (project: string, models: string[], controllers: string[], views: string[], routes: string | null, rootFile: string | null): string => {
  const lines: string[] = ['import type { AppManifest } from "@lightstart/app/manifest.ts";'];
  lines.push(`import app from "${specifierFor(project, join(project, "src", "app.ts"))}";`);
  models.forEach((file, index) => lines.push(`import model${String(index)} from "${specifierFor(project, file)}";`));
  controllers.forEach((file, index) => lines.push(`import controller${String(index)} from "${specifierFor(project, file)}";`));
  if (routes !== null) lines.push(`import routes from "${specifierFor(project, routes)}";`);
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

const modeImport = (project: string, file: string, index: number): string =>
  `import * as mode${String(index)} from "${specifierFor(project, file)}";`;

const modeDispatch = (file: string, index: number): string[] => {
  const name = nameOf(file);
  return [
    `const matches${String(index)} = Reflect.get(mode${String(index)}, "matches");`,
    "",
    `if (typeof matches${String(index)} === "function" ? (matches${String(index)} as (given: readonly string[]) => boolean)(argv) : argv.includes(${JSON.stringify(`--${name}`)})) {`,
    `  process.exit(await mode${String(index)}.main(argv));`,
    "}",
  ];
};

const mainSource = (project: string, host: string, modes: string[]): string => {
  if (host !== "tui") {
    return [
      `import { start } from "@lightstart/app/${host}";`,
      'import manifest from "./app.ts";',
      "",
      "await start(manifest);",
      "",
    ].join("\n");
  }
  const lines: string[] = [
    'import { start } from "@lightstart/app/tui";',
    'import manifest from "./app.ts";',
    'import { dark, light } from "./classes.baked.ts";',
  ];
  modes.forEach((file, index) => lines.push(modeImport(project, file, index)));
  if (modes.length > 0) {
    lines.push("", "const argv = process.argv.slice(2);", "");
    modes.forEach((file, index) => lines.push(...modeDispatch(file, index)));
    lines.push("");
  }
  lines.push("await start(manifest, { classes: { dark, light } });", "");
  return lines.join("\n");
};

const rootFileOf = (views: string[], root: string): string => {
  const found = views.find((file) => nameOf(file) === root);
  if (found === undefined) throw new Error(`The terminal app's root view is src/views/${root}.ts, and it is not there`);
  return found;
};

const bakedSource = async (main: string): Promise<string> => {
  const ts = (await import("@lightstart/light/check/parse/typescript.js")).default;
  const found = collectClasses(main, ts);
  const baked = bakeTables(found.classes, defaultTheme, ["dark", "light"]);
  const problems = [...found.problems, ...baked.problems];
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return renderClasses(baked.tables, ".light/main.ts", "light classes:bake .light/main.ts -o .light/classes.baked.ts --scheme dark,light")
    .replace('/** @import { BakedEntry } from "@lightstart/light/theme/baked" */', 'import type { BakedEntry } from "@lightstart/light/theme/baked";')
    .replaceAll("/** @type {BakedEntry[]} */\n", "")
    .replace(/^export const (\w+) = \[$/gm, "export const $1: BakedEntry[] = [");
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
  const modes = info.host === "tui" ? flatFiles(join(project, "src", "modes")) : [];
  const rootFile = info.host === "tui" ? rootFileOf(views, info.root) : null;
  const classes = info.host === "tui" ? join(dir, "classes.baked.ts") : null;
  const wroteManifest = writeWhenChanged(manifest, manifestSource(project, models, controllers, views, routes, rootFile));
  const wroteMain = writeWhenChanged(main, mainSource(project, info.host, modes));
  const wroteClasses = classes === null ? false : writeWhenChanged(classes, await bakedSource(main));

  return {
    dir,
    app,
    manifest,
    main,
    classes,
    host: info.host,
    models: models.map(nameOf),
    controllers: controllers.map(nameOf),
    views: views.map(nameOf),
    modes: modes.map(nameOf),
    routes: routes !== null,
    changed: wroteManifest || wroteMain || wroteClasses,
  };
};
