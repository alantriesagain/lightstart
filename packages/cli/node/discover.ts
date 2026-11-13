/**
 * @file The node discovery: it walks a project's `cli/` folders and loads the files with
 * `import()`. It is the only place a computed path reaches an import, so the core stays fully
 * static.
 */
import { statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hookNameOf } from "../hooks.ts";
import type { ArgsSchema, Command } from "../types/command.ts";
import type { Logger } from "../types/context.ts";
import type { Discovered, DiscoverOptions, LoadedCommand, LoadedHook, Source } from "../types/discovery.ts";
import { listScopedPackages, readPackageJson, walkFiles } from "./pkg-walk.ts";

const CODE_EXTENSIONS = [".ts", ".js", ".mjs"];

const CLI_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

const exists = (path: string): boolean => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};

const stripExt = (name: string): string => name.replace(/\.(ts|js|mjs)$/, "");

const codeFiles = (dir: string): string[] => walkFiles(dir, { extensions: CODE_EXTENSIONS });

const commandNameFromFile = (file: string, commandsDir: string): string => stripExt(relative(commandsDir, file)).split(sep).join(":");

const hookNameFromFile = (file: string, hooksDir: string): string => hookNameOf(stripExt(relative(hooksDir, file)).split(sep).join("/"));

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : typeof err === "string" ? err : "an unknown error");

/** Load a module by its file path. */
export const importFile = async (file: string): Promise<unknown> => await import(pathToFileURL(file).href);

const scanCliRoot = async (source: Source, out: Discovered, log: Logger): Promise<void> => {
  const cliDir = join(source.root, "cli");
  if (!exists(cliDir)) return;

  const commandsDir = join(cliDir, "commands");
  for (const file of codeFiles(commandsDir)) {
    const name = commandNameFromFile(file, commandsDir);
    const existing = out.commands.get(name);
    if (existing) {
      log.warn(`Command "${name}" already registered by ${existing.source.name}; ignoring duplicate from ${source.name}`);
      continue;
    }
    let mod: { default?: unknown };
    try {
      mod = (await importFile(file)) as { default?: unknown };
    } catch (err) {
      log.warn(`Command "${name}" at ${file} failed to load: ${messageOf(err)}`);
      continue;
    }
    const definition = mod.default;
    if (definition === null || typeof definition !== "object") {
      log.warn(`Command "${name}" at ${file} must export a default Command with a run() method`);
      continue;
    }
    const run = (definition as { run?: unknown }).run;
    if (typeof run !== "function") {
      log.warn(`Command "${name}" at ${file} must export a default Command with a run() method`);
      continue;
    }
    const record: LoadedCommand = { command: definition as Command<ArgsSchema>, source };
    out.commands.set(name, record);
  }

  for (const file of codeFiles(join(cliDir, "routes"))) {
    try {
      const mod = (await importFile(file)) as { default?: unknown };
      if (typeof mod.default === "function") out.routes.push({ app: mod.default, source });
      else log.warn(`Route file ${file} from ${source.name} default-exports no function`);
    } catch (err) {
      log.warn(`Route file ${file} from ${source.name} failed to load: ${messageOf(err)}`);
    }
  }

  const hooksDir = join(cliDir, "hooks");
  for (const file of codeFiles(hooksDir)) {
    const name = hookNameFromFile(file, hooksDir);
    let mod: { default?: unknown };
    try {
      mod = (await importFile(file)) as { default?: unknown };
    } catch (err) {
      log.warn(`Hook ${name} from ${source.name} failed to load: ${messageOf(err)}`);
      continue;
    }
    if (typeof mod.default !== "function") {
      log.warn(`Hook ${name} from ${source.name} exports no function`);
      continue;
    }
    const list = out.hooks.get(name) ?? [];
    const hook: LoadedHook = { fn: mod.default, source };
    list.push(hook);
    out.hooks.set(name, list);
  }
};

/**
 * Everything in reach contributes in tiers: the project's own `cli/` and `server/routes/`, the
 * project's scoped packages, the extra package names it names, then the CLI's own installed
 * scoped packages. A command name is taken by the first tier that declares it.
 */
export const discover = async (options: DiscoverOptions): Promise<Discovered> => {
  const out: Discovered = {
    commands: new Map<string, LoadedCommand>(),
    routes: [],
    hooks: new Map<string, LoadedHook[]>(),
    cliDir: CLI_DIR,
  };
  const scanned = new Set<string>();
  const projectSource: Source = { name: "<project>", root: options.projectDir };

  await scanCliRoot(projectSource, out, options.log);
  scanned.add(options.projectDir);

  for (const file of codeFiles(join(options.projectDir, "server", "routes"))) {
    try {
      const mod = (await importFile(file)) as { default?: unknown };
      if (typeof mod.default === "function") out.routes.push({ app: mod.default, source: projectSource });
      else options.log.warn(`Route file ${file} from <project> default-exports no function`);
    } catch (err) {
      options.log.warn(`Route file ${file} from <project> failed to load: ${messageOf(err)}`);
    }
  }

  for (const entry of listScopedPackages({ roots: [options.projectDir], scopes: options.scopes })) {
    if (scanned.has(entry.dir)) continue;
    scanned.add(entry.dir);
    await scanCliRoot({ name: entry.name, root: entry.dir }, out, options.log);
  }

  for (const packageName of options.packages) {
    const dir = join(options.projectDir, "node_modules", packageName);
    if (!exists(dir) || scanned.has(dir)) continue;
    scanned.add(dir);
    const pkg = readPackageJson(dir);
    await scanCliRoot({ name: pkg && typeof pkg.name === "string" ? pkg.name : packageName, root: dir }, out, options.log);
  }

  for (const entry of listScopedPackages({ roots: [CLI_DIR], scopes: options.scopes })) {
    if (scanned.has(entry.dir)) continue;
    scanned.add(entry.dir);
    await scanCliRoot({ name: entry.name, root: entry.dir }, out, options.log);
  }

  return out;
};
