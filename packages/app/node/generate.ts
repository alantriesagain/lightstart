/**
 * @file The generation behind `light app`, `light serve`, `light build` and
 * `light test`: read `src/app.ts` and the project's folders, and write
 * `.light/app.ts` with a static import of every model, controller, view and
 * the routes, plus its manifest, and `.light/main.ts` with the host's start.
 * The output is sorted and written only when it changed. A folder with no
 * `src/app.ts` is left alone.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
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
  models: string[];
  controllers: string[];
  views: string[];
  routes: boolean;
  /** Whether either file was written; false when both already held this content. */
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

const specifierFor = (from: string, to: string): string => `../${relative(from, to).split(sep).join("/")}`;

const writeWhenChanged = (path: string, content: string): boolean => {
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (before === content) return false;
  writeFileSync(path, content);
  return true;
};

const hostOf = async (app: string): Promise<string> => {
  try {
    const module = await import(`${pathToFileURL(app).href}?mtime=${String(Date.now())}`);
    const config = (module as { default?: { host?: unknown } }).default;
    return config !== undefined && config.host === "tui" ? "tui" : "web";
  } catch {
    return "web";
  }
};

const manifestSource = (project: string, models: string[], controllers: string[], views: string[], routes: string | null): string => {
  const lines: string[] = ['import type { AppManifest } from "@lightstart/app/manifest.ts";'];
  lines.push(`import app from "${specifierFor(project, join(project, "src", "app.ts"))}";`);
  models.forEach((file, index) => lines.push(`import model${String(index)} from "${specifierFor(project, file)}";`));
  controllers.forEach((file, index) => lines.push(`import controller${String(index)} from "${specifierFor(project, file)}";`));
  if (routes !== null) lines.push(`import routes from "${specifierFor(project, routes)}";`);
  for (const file of views) lines.push(`import "${specifierFor(project, file)}";`);

  lines.push("");
  lines.push("const manifest: AppManifest = {");
  lines.push("  app,");
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

const mainSource = (host: string): string =>
  [
    `import { start } from "@lightstart/app/${host}";`,
    'import manifest from "./app.ts";',
    "",
    "await start(manifest);",
    "",
  ].join("\n");

/** Generate the project's `.light` manifest and entry; null when there is no `src/app.ts`. */
export const generate = async (project: string): Promise<Generated | null> => {
  const app = join(project, "src", "app.ts");
  if (!existsSync(app)) return null;

  const models = flatFiles(join(project, "src", "models"));
  const controllers = flatFiles(join(project, "src", "controllers"));
  const views = flatFiles(join(project, "src", "views"));
  const routes = existsSync(join(project, "src", "routes.ts")) ? join(project, "src", "routes.ts") : null;

  const dir = join(project, ".light");
  mkdirSync(dir, { recursive: true });
  const manifest = join(dir, "app.ts");
  const main = join(dir, "main.ts");
  const host = await hostOf(app);
  const wroteManifest = writeWhenChanged(manifest, manifestSource(project, models, controllers, views, routes));
  const wroteMain = writeWhenChanged(main, mainSource(host));

  return {
    dir,
    app,
    manifest,
    main,
    models: models.map(nameOf),
    controllers: controllers.map(nameOf),
    views: views.map(nameOf),
    routes: routes !== null,
    changed: wroteManifest || wroteMain,
  };
};
