/**
 * @file `build`: read a page, bundle its modules and stylesheets through its importmap, copy
 * `public/`, write the rewritten page, then hand the outputs to the kept build folder.
 */
import { existsSync, promises as fs } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { bundleModules, bundleStyles } from "./bundle.ts";
import { generateBuildId } from "./build-id.ts";
import { BuildSteps } from "./extension.ts";
import type { BuildExtension, BuildExtensionOptions } from "./extension.ts";
import { parsePage, renderPage } from "./html.ts";
import { parseImportMap } from "./importmap.ts";
import type { BuildContext, BuildFile, BuildLog, BuildOptions, BuildReport, BuildStep } from "./types.ts";
import { cleanupOldBuilds, updateCurrent } from "./versioning.ts";

const readPage = async (ctx: BuildContext): Promise<void> => {
  const html = await fs.readFile(ctx.pagePath, "utf8");
  ctx.parsed = parsePage(html, dirname(ctx.pagePath));
  ctx.importMap = ctx.parsed.importMapText === null ? { imports: {} } : parseImportMap(ctx.parsed.importMapText);
  ctx.moduleOutputs = ctx.parsed.modules.map(() => undefined);
  ctx.styleOutputs = ctx.parsed.stylesheets.map(() => undefined);
};

const copyDirectory = async (ctx: BuildContext, absolute: string, prefix: string): Promise<void> => {
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  for (const entry of entries) {
    const source = resolve(absolute, entry.name);
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await copyDirectory(ctx, source, rel);
      continue;
    }
    if (!entry.isFile() || ctx.outputs.has(rel)) continue;
    ctx.outputs.set(rel, await fs.readFile(source));
  }
};

const copyPublic = async (ctx: BuildContext): Promise<void> => {
  const publicDir = resolve(ctx.root, "public");
  if (existsSync(publicDir)) await copyDirectory(ctx, publicDir, "");
};

const pageUrl = (ctx: BuildContext, output: string): string => {
  const from = dirname(relative(ctx.root, ctx.pagePath)).split("\\").join("/");
  const url = relative(from === "" ? "." : from, output).split("\\").join("/");
  return url.startsWith(".") ? url : `./${url}`;
};

const writePage = async (ctx: BuildContext): Promise<void> => {
  const modules = ctx.moduleOutputs.map((output) => (output === undefined ? undefined : pageUrl(ctx, output)));
  const styles = ctx.styleOutputs.map((output) => (output === undefined ? undefined : pageUrl(ctx, output)));
  const html = renderPage(ctx.parsed, modules, styles);
  ctx.outputs.set(relative(ctx.root, ctx.pagePath).split("\\").join("/"), html);
};

const writeBuild = async (ctx: BuildContext): Promise<void> => {
  await fs.mkdir(ctx.buildDir, { recursive: true });
  for (const [path, content] of ctx.outputs) {
    const destination = resolve(ctx.buildDir, path);
    await fs.mkdir(dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
  }
  await updateCurrent(ctx.outDir, ctx.id);
  await cleanupOldBuilds(ctx.outDir, ctx.keep);
  ctx.log(`wrote ${ctx.outputs.size} files to ${ctx.buildDir}`);
};

const uniqueId = async (outDir: string): Promise<string> => {
  const base = generateBuildId();
  let id = base;
  let attempt = 2;
  while (existsSync(resolve(outDir, "builds", id))) {
    id = `${base}-${attempt}`;
    attempt += 1;
  }
  return id;
};

const byteLength = (content: Uint8Array | string): number => (typeof content === "string" ? Buffer.byteLength(content) : content.byteLength);

const builtInSteps = (): BuildStep[] => [
  { name: "page", run: readPage },
  { name: "modules", run: bundleModules },
  { name: "stylesheets", run: bundleStyles },
  { name: "public", run: copyPublic },
  { name: "html", run: writePage },
  { name: "write", run: writeBuild },
];

const resolvedOptions = (options: BuildOptions): BuildExtensionOptions => {
  const root = resolve(options.root);
  const keep = options.keep ?? 5;
  return {
    root,
    page: options.page ?? "index.html",
    outDir: resolve(root, options.outDir ?? ".deployed"),
    minify: options.minify ?? true,
    keep: Number.isFinite(keep) ? Math.max(1, keep) : 5,
  };
};

/** The api `light build` hands an extension: the built-in steps, the resolved options, `spa` and empty data. */
export const createBuildExtension = (options: BuildOptions): BuildExtension => ({
  steps: new BuildSteps(builtInSteps()),
  options: resolvedOptions(options),
  mode: "spa",
  data: new Map<string, unknown>(),
});

const runBuild = async (extension: BuildExtension, log: BuildLog): Promise<BuildReport> => {
  const started = Date.now();
  const { root, page, outDir, minify } = extension.options;
  const keep = Number.isFinite(extension.options.keep) ? Math.max(1, extension.options.keep) : 5;
  const pagePath = resolve(root, page);
  const id = await uniqueId(outDir);
  const buildDir = resolve(outDir, "builds", id);

  const ctx: BuildContext = {
    root,
    page,
    pagePath,
    outDir,
    buildDir,
    id,
    minify,
    keep,
    mode: extension.mode,
    data: extension.data,
    importMap: { imports: {} },
    parsed: parsePage("", dirname(pagePath)),
    moduleOutputs: [],
    styleOutputs: [],
    outputs: new Map<string, Uint8Array | string>(),
    log,
  };

  for (const step of extension.steps.list()) await step.run(ctx);

  const files: BuildFile[] = [...ctx.outputs.entries()]
    .map(([path, content]) => ({ path, bytes: byteLength(content) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { id, dir: buildDir, files, ms: Date.now() - started };
};

/**
 * Build a page and its assets into `<root>/<outDir>/builds/<id>/`, point `current` at it, and prune old builds.
 * `steps` adds steps before `write`; `mode` and `data` are what the steps read. When `extension` is
 * given it is the api the command already widened, and its options, mode, data and steps are used.
 */
export const build = async (options: BuildOptions, extension?: BuildExtension): Promise<BuildReport> => {
  const log = options.log ?? (() => undefined);
  if (extension !== undefined) return await runBuild(extension, log);
  const created = createBuildExtension(options);
  created.mode = options.mode ?? "spa";
  created.data = options.data ?? new Map<string, unknown>();
  for (const step of options.steps ?? []) created.steps.add(step);
  return await runBuild(created, log);
};

export type { BuildContext, BuildFile, BuildLog, BuildOptions, BuildReport, BuildStep } from "./types.ts";
export type { BuildExtension, BuildExtensionOptions } from "./extension.ts";
export type { ImportMap } from "./importmap.ts";
