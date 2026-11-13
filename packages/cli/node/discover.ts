/**
 * @file The node discovery: it walks a project's `cli/` folders and lists the files, importing
 * none. Importing happens through `NodeFileLoader`, the only place a computed path reaches an
 * `import()`, so the core stays fully static.
 */
import { realpathSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hookNameOf } from "../hooks.ts";
import type { Logger } from "../types/context.ts";
import type { CommandRecord, Discovered, DiscoverOptions, ExtensionRecord, HookRecord, RouteRecord, Source } from "../types/discovery.ts";
import { FileLoader as Loader } from "../types/discovery.ts";
import type { PackageJson } from "./pkg-walk.ts";
import { findWorkspaceRoot, listScopedPackages, readPackageJson, walkFiles } from "./pkg-walk.ts";

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

const realPath = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

const stripExt = (name: string): string => name.replace(/\.(ts|js|mjs)$/, "");

const codeFiles = (dir: string): string[] => walkFiles(dir, { extensions: CODE_EXTENSIONS });

const commandNameFromFile = (file: string, commandsDir: string): string => stripExt(relative(commandsDir, file)).split(sep).join(":");

const hookNameFromFile = (file: string, hooksDir: string): string => hookNameOf(stripExt(relative(hooksDir, file)).split(sep).join("/"));

const lightField = (pkg: PackageJson | null): Record<string, unknown> | null => {
  if (!pkg) return null;
  const light = pkg.light;
  if (light === null || typeof light !== "object" || Array.isArray(light)) return null;
  return light as Record<string, unknown>;
};

const stringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const list: string[] = [];
  for (const item of value) if (typeof item === "string") list.push(item);
  return list;
};

/** Load a module by its file path. */
export const importFile = async (file: string): Promise<unknown> => await import(pathToFileURL(file).href);

/** The loader the core uses; it is the one module allowed a computed `import()`. */
export class NodeFileLoader extends Loader {
  load(file: string): Promise<unknown> {
    return import(pathToFileURL(file).href);
  }
}

type CliRoot = { cliDir: string; source: Source };

const cliRootsOf = (packageDir: string, sourceName: string, pkg: PackageJson | null): CliRoot[] => {
  const light = lightField(pkg);
  const folders = light ? stringList(light.cli) : [];
  if (folders.length === 0) return [{ cliDir: join(packageDir, "cli"), source: { name: sourceName, root: packageDir } }];
  const roots: CliRoot[] = [];
  for (const folder of folders) roots.push({ cliDir: join(packageDir, folder, "cli"), source: { name: `${sourceName}/${folder}`, root: packageDir } });
  return roots;
};

const listCliRoot = (cliDir: string, source: Source, out: Discovered, log: Logger): void => {
  if (!exists(cliDir)) return;

  const commandsDir = join(cliDir, "commands");
  for (const file of codeFiles(commandsDir)) {
    const name = commandNameFromFile(file, commandsDir);
    const existing = out.commands.get(name);
    if (existing) {
      log.warn(`Command "${name}" already registered by ${existing.source.name}; ignoring duplicate from ${source.name}`);
      continue;
    }
    const record: CommandRecord = { file, source };
    out.commands.set(name, record);
  }

  for (const file of codeFiles(join(cliDir, "routes"))) {
    const record: RouteRecord = { file, source };
    out.routes.push(record);
  }

  const hooksDir = join(cliDir, "hooks");
  for (const file of codeFiles(hooksDir)) {
    const name = hookNameFromFile(file, hooksDir);
    const record: HookRecord = { file, source };
    const list = out.hooks.get(name) ?? [];
    list.push(record);
    out.hooks.set(name, list);
  }

  const extendDir = join(cliDir, "extend");
  for (const file of codeFiles(extendDir)) {
    const command = commandNameFromFile(file, extendDir);
    const record: ExtensionRecord = { file, source, command };
    const list = out.extensions.get(command) ?? [];
    list.push(record);
    out.extensions.set(command, list);
  }
};

const scanPackage = (packageDir: string, sourceName: string, pkg: PackageJson | null, out: Discovered, log: Logger): void => {
  for (const root of cliRootsOf(packageDir, sourceName, pkg)) listCliRoot(root.cliDir, root.source, out, log);
};

/**
 * Everything in reach contributes in tiers: the project's own `cli/` and `server/routes/`, the
 * scoped packages under the project and its workspace root, the extra package names it names, and
 * the CLI's own installed scoped packages. A command name is taken by the first tier that declares
 * it; every hook, route and extension is kept in order.
 */
export const discover = async (options: DiscoverOptions): Promise<Discovered> => {
  const cliDir = options.cliDir ?? CLI_DIR;
  const out: Discovered = {
    commands: new Map<string, CommandRecord>(),
    routes: [],
    hooks: new Map<string, HookRecord[]>(),
    extensions: new Map<string, ExtensionRecord[]>(),
    cliDir,
    loader: new NodeFileLoader(),
  };
  const scanned = new Set<string>();
  const projectPkg = readPackageJson(options.projectDir);
  const projectSource: Source = { name: "<project>", root: options.projectDir };

  const workspace = findWorkspaceRoot(options.projectDir);
  const configs = [lightField(projectPkg), workspace === null ? null : lightField(readPackageJson(workspace))];
  const declared: string[] = [];
  const declaredPackages: string[] = [];
  for (const light of configs) {
    if (!light) continue;
    declared.push(...stringList(light.scopes));
    declaredPackages.push(...stringList(light.packages));
  }
  const scopes: string[] = [];
  const seenScopes = new Set<string>();
  for (const scope of options.scopes) {
    if (seenScopes.has(scope)) continue;
    seenScopes.add(scope);
    scopes.push(scope);
  }
  for (const scope of declared) {
    if (seenScopes.has(scope)) continue;
    seenScopes.add(scope);
    scopes.push(scope);
  }

  scanPackage(options.projectDir, projectSource.name, projectPkg, out, options.log);
  scanned.add(realPath(options.projectDir));

  for (const file of codeFiles(join(options.projectDir, "server", "routes"))) {
    const record: RouteRecord = { file, source: projectSource };
    out.routes.push(record);
  }

  const packageRoots: string[] = [options.projectDir];
  if (workspace !== null) packageRoots.push(workspace);

  for (const root of packageRoots) {
    for (const entry of listScopedPackages({ roots: [root], scopes })) {
      const dir = realPath(entry.dir);
      if (scanned.has(dir)) continue;
      scanned.add(dir);
      scanPackage(dir, entry.name, readPackageJson(dir) ?? entry.pkg, out, options.log);
    }
  }

  for (const packageName of [...options.packages, ...declaredPackages]) {
    const found = packageRoots.map((root) => join(root, "node_modules", packageName)).find((candidate) => exists(candidate));
    if (found === undefined) continue;
    const dir = realPath(found);
    if (scanned.has(dir)) continue;
    scanned.add(dir);
    const pkg = readPackageJson(dir);
    scanPackage(dir, pkg && typeof pkg.name === "string" ? pkg.name : packageName, pkg, out, options.log);
  }

  for (const entry of listScopedPackages({ roots: [cliDir], scopes })) {
    const dir = realPath(entry.dir);
    if (scanned.has(dir)) continue;
    scanned.add(dir);
    scanPackage(dir, entry.name, readPackageJson(dir) ?? entry.pkg, out, options.log);
  }

  return out;
};
