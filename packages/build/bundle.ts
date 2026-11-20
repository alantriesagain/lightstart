/**
 * @file Bundling through esbuild: the page's module scripts (inline ones as virtual entries) with
 * bare specifiers resolved through the page's importmap, and each stylesheet with its imports and
 * `url()` assets. Outputs are kept in memory, named with a content hash.
 */
import * as esbuild from "esbuild";
import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { resolveSpecifier } from "./importmap.ts";
import type { ImportMap } from "./importmap.ts";
import type { BuildContext } from "./types.ts";

type Entry = { in: string; out: string; virtual?: boolean };

const EXTENSIONS = ["", ".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx", ".json"];
const INDEXES = ["index.js", "index.ts", "index.mjs", "index.cjs"];

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const probeFile = (path: string): string | null => {
  for (const extension of EXTENSIONS) if (isFile(path + extension)) return path + extension;
  if (isDirectory(path)) for (const name of INDEXES) if (isFile(resolve(path, name))) return resolve(path, name);
  return null;
};

const isBare = (specifier: string): boolean => !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("\\") && !/^[a-z][a-z0-9+.-]*:/i.test(specifier);

const makePlugin = (importMap: ImportMap, pageDir: string, inline: Map<string, string>): esbuild.Plugin => ({
  name: "light-importmap",
  setup(build) {
    build.onResolve({ filter: /^light-virtual:/ }, (args) => ({ path: args.path, namespace: "light-virtual" }));
    build.onLoad({ filter: /.*/, namespace: "light-virtual" }, (args) => ({
      contents: inline.get(args.path) ?? "",
      loader: "js",
      resolveDir: pageDir,
    }));
    build.onResolve({ filter: /^[^./\\]/ }, (args) => {
      if (!isBare(args.path)) return null;
      const mapped = resolveSpecifier(importMap, args.path, pageDir);
      if (mapped === null) return null;
      return { path: probeFile(mapped) ?? mapped };
    });
  },
});

const LOADERS: Record<string, esbuild.Loader> = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".json": "json",
  ".png": "file",
  ".jpg": "file",
  ".jpeg": "file",
  ".gif": "file",
  ".svg": "file",
  ".webp": "file",
  ".avif": "file",
  ".ico": "file",
  ".woff": "file",
  ".woff2": "file",
  ".ttf": "file",
  ".otf": "file",
  ".eot": "file",
};

const formatError = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as { errors?: { text: string; location?: { file?: string; line?: number; column?: number } | null }[] }).errors ?? [];
    if (errors.length > 0)
      return errors
        .map((entry) => {
          const at = entry.location;
          const where = at === null || at === undefined ? "" : `${at.file ?? ""}:${at.line ?? 0}:${at.column ?? 0}: `;
          return `${where}${entry.text}`;
        })
        .join("\n");
  }
  return error instanceof Error ? error.message : String(error);
};

const outputPath = (ctx: BuildContext, key: string): string => {
  const absolute = resolve(ctx.root, key);
  return relative(ctx.buildDir, absolute).split("\\").join("/");
};

const bundle = async (ctx: BuildContext, entries: Entry[], inline: Map<string, string>, entryNames = "[name]-[hash]"): Promise<esbuild.BuildResult> => {
  try {
    return await esbuild.build({
      absWorkingDir: ctx.root,
      entryPoints: entries.map((entry) => ({ in: entry.in, out: entry.out })),
      outdir: ctx.buildDir,
      outbase: dirname(ctx.pagePath),
      bundle: true,
      format: "esm",
      splitting: true,
      minify: ctx.minify,
      sourcemap: false,
      target: "es2022",
      entryNames,
      chunkNames: "[name]-[hash]",
      assetNames: "[name]-[hash]",
      loader: LOADERS,
      write: false,
      metafile: true,
      logLevel: "silent",
      plugins: [makePlugin(ctx.importMap, dirname(ctx.pagePath), inline)],
    });
  } catch (error) {
    throw new Error(`esbuild: ${formatError(error)}`);
  }
};

const collect = (ctx: BuildContext, result: esbuild.BuildResult): void => {
  for (const file of result.outputFiles ?? []) ctx.outputs.set(relative(ctx.buildDir, file.path).split("\\").join("/"), file.contents);
};

type EntryOutput = { key: string; path: string };

const entryOutput = (ctx: BuildContext, result: esbuild.BuildResult, entry: Entry): EntryOutput | undefined => {
  for (const [key, output] of Object.entries(result.metafile?.outputs ?? {})) {
    if (output.entryPoint === undefined) continue;
    const matches = entry.virtual === true ? output.entryPoint.endsWith(entry.in) : resolve(ctx.root, output.entryPoint) === entry.in;
    if (matches) return { key, path: outputPath(ctx, key) };
  }
  return undefined;
};

const outputFor = (ctx: BuildContext, result: esbuild.BuildResult, entry: Entry): string | undefined => entryOutput(ctx, result, entry)?.path;

const staticImports = (result: esbuild.BuildResult, entry: string): string[] => {
  const outputs = result.metafile?.outputs ?? {};
  const found = new Set<string>();
  const visit = (key: string): void => {
    const output = outputs[key];
    if (output === undefined) return;
    for (const imported of output.imports) {
      if (imported.kind !== "import-statement" || imported.external === true) continue;
      const dependency = outputs[imported.path];
      if (dependency === undefined || dependency.entryPoint !== undefined || found.has(imported.path)) continue;
      found.add(imported.path);
      visit(imported.path);
    }
  };
  visit(entry);
  return [...found];
};

/** Bundle the app's worker entry, when generation wrote one, under the fixed name `worker.js`. */
const bundleWorker = async (ctx: BuildContext): Promise<void> => {
  const file = [join(ctx.root, ".light", "worker.js"), join(ctx.root, ".light", "worker.ts")].find((candidate) => existsSync(candidate));
  if (file === undefined) return;
  const result = await bundle(ctx, [{ in: file, out: "worker" }], new Map<string, string>(), "[name]");
  collect(ctx, result);
};

/** Bundle the page's module scripts and put their outputs in the context. */
export const bundleModules = async (ctx: BuildContext): Promise<void> => {
  await bundleWorker(ctx);
  const entries: Entry[] = [];
  const inline = new Map<string, string>();
  ctx.moduleOutputs = ctx.parsed.modules.map((module, index) => {
    const out = `module-${index}`;
    if (module.kind === "external") {
      entries.push({ in: module.path, out });
      return undefined;
    }
    const name = `light-virtual:inline-${index}`;
    inline.set(name, module.code);
    entries.push({ in: name, out, virtual: true });
    return undefined;
  });
  if (entries.length === 0) return;
  const result = await bundle(ctx, entries, inline);
  collect(ctx, result);
  const preloads = new Set<string>();
  entries.forEach((entry, index) => {
    const output = entryOutput(ctx, result, entry);
    ctx.moduleOutputs[index] = output?.path;
    if (output !== undefined) for (const key of staticImports(result, output.key)) preloads.add(outputPath(ctx, key));
  });
  ctx.modulePreloads = [...preloads];
};

/** Bundle each linked stylesheet and put its output and assets in the context. */
export const bundleStyles = async (ctx: BuildContext): Promise<void> => {
  if (ctx.parsed.stylesheets.length === 0) return;
  const entries: Entry[] = ctx.parsed.stylesheets.map((stylesheet, index) => ({ in: stylesheet.path, out: `style-${index}` }));
  const result = await bundle(ctx, entries, new Map<string, string>());
  collect(ctx, result);
  ctx.styleOutputs = entries.map((entry) => outputFor(ctx, result, entry));
};
