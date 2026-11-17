/**
 * @file The generator behind `light new`: find the light checkout, put its packages in the new
 * project's package.json (`link:` for pnpm, `file:` for npm, semver ranges for `--npm`), add the
 * packages they need, copy the kind's template with its tokens replaced, and run the install.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { titleOf } from "./kinds.ts";
import type { Kind } from "./kinds.ts";

/** How the light packages are named in the generated package.json. */
export type InstallMode = "link" | "file" | "npm";

/** The package manager the install runs with. */
export type PackageManager = "pnpm" | "npm";

/** What `generate` needs, after the command has read its flags. */
export type GenerateOptions = {
  kind: Kind;
  /** The package name, and the folder name when `--dir` is not given. */
  name: string;
  /** The folder to write into. */
  target: string;
  /** The light checkout that holds `packages/light`. */
  lightRoot: string;
  mode: InstallMode;
  pm: PackageManager;
  install: boolean;
  force: boolean;
  log?: (message: string) => void;
};

/** The generated package.json. */
export type GeneratedManifest = {
  name: string;
  type: "module";
  private?: true;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  [field: string]: unknown;
};

type PackageManifest = {
  version?: string;
  dependencies?: Record<string, string>;
};

const SCOPE = "@lightstart/";
const here = dirname(fileURLToPath(import.meta.url));

/** Whether `dir` is a light checkout: it holds `packages/light`. */
export const isCheckout = (dir: string): boolean => existsSync(join(dir, "packages", "light", "package.json"));

/** The checkout the generator runs from, or null when it is installed outside one. */
export const findCheckout = (): string | null => {
  const root = resolve(here, "..", "..");
  return isCheckout(root) ? root : null;
};

/** The checkout `--light` names, else the one the generator runs from. */
export const resolveCheckout = (light?: string): string => {
  if (light !== undefined) {
    const root = resolve(light);
    if (!isCheckout(root)) throw new Error(`${root} is not a light checkout: it has no packages/light.`);
    return root;
  }
  const root = findCheckout();
  if (root === null) throw new Error("No light checkout found. Pass --light <path> to the checkout that holds packages/light.");
  return root;
};

/** The folder of a light package inside a checkout: `@lightstart/light` is `packages/light`. */
export const lightPackageDir = (root: string, name: string): string => join(root, "packages", name.slice(SCOPE.length));

const readManifest = (root: string, name: string): PackageManifest => {
  const file = join(lightPackageDir(root, name), "package.json");
  try {
    return JSON.parse(readFileSync(file, "utf8")) as PackageManifest;
  } catch {
    throw new Error(`@lightstart/create: no package ${name} in ${root}.`);
  }
};

const versionOf = (root: string, name: string): string => readManifest(root, name).version ?? "0.1.0";

const lightDependenciesOf = (root: string, name: string): string[] =>
  Object.keys(readManifest(root, name).dependencies ?? {}).filter((dependency) => dependency.startsWith(SCOPE));

/** The packages named, and every light package they depend on, each once, in discovery order. */
export const dependencyClosure = (root: string, names: readonly string[]): string[] => {
  const found: string[] = [];
  const seen = new Set<string>();
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.shift();
    if (name === undefined || seen.has(name)) continue;
    seen.add(name);
    found.push(name);
    for (const dependency of lightDependenciesOf(root, name)) queue.push(dependency);
  }
  return found;
};

const installValue = (root: string, name: string, mode: InstallMode): string => {
  if (mode === "npm") return `^${versionOf(root, name)}`;
  return `${mode}:${lightPackageDir(root, name)}`;
};

const mapTokens = (value: unknown, name: string, title: string): unknown => {
  if (typeof value === "string") return replaceTokens(value, name, title);
  if (Array.isArray(value)) return value.map((entry) => mapTokens(entry, name, title));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, mapTokens(entry, name, title)]));
  return value;
};

/** The package.json for a kind, with light linked (`link`/`file`) or named by version (`npm`). */
export const manifestFor = (kind: Kind, name: string, root: string, mode: InstallMode): GeneratedManifest => {
  const dependencies: Record<string, string> = {};
  for (const pkg of dependencyClosure(root, kind.packages)) dependencies[pkg] = installValue(root, pkg, mode);

  const devDependencies: Record<string, string> = {};
  const devLight: string[] = [];
  for (const [pkg, range] of Object.entries(kind.devDependencies)) {
    if (pkg.startsWith(SCOPE)) devLight.push(pkg);
    else devDependencies[pkg] = range;
  }
  for (const pkg of dependencyClosure(root, devLight))
    if (dependencies[pkg] === undefined && devDependencies[pkg] === undefined) devDependencies[pkg] = installValue(root, pkg, mode);

  return {
    name,
    ...(kind.manifest === undefined ? {} : mapTokens(kind.manifest, name, titleOf(name)) as Record<string, unknown>),
    type: "module",
    ...(kind.publishable === true ? {} : { private: true as const }),
    scripts: Object.fromEntries(Object.entries(kind.scripts).map(([script, line]) => [script, replaceTokens(line, name, titleOf(name))])),
    dependencies,
    devDependencies,
  };
};

/** Write `__NAME__` and `__TITLE__` into a template file's text. */
export const replaceTokens = (text: string, name: string, title: string): string =>
  text.replaceAll("__NAME__", name).replaceAll("__TITLE__", title);

/** Copy a template folder into `target`, dropping `.tpl` from a name and replacing its tokens. */
export const copyTemplate = (templateDir: string, target: string, name: string, title: string): string[] => {
  const written: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const source = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(source);
        continue;
      }
      if (!entry.isFile()) continue;
      const output = entry.name.endsWith(".tpl") ? entry.name.slice(0, -4) : entry.name;
      const destination = join(target, relative(templateDir, join(dir, output)));
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, replaceTokens(readFileSync(source, "utf8"), name, title));
      written.push(relative(target, destination));
    }
  };
  walk(templateDir);
  return written.sort();
};

/** Make the target folder, refusing a folder that already holds something unless `force`. */
export const ensureTarget = (target: string, force: boolean): void => {
  if (existsSync(target)) {
    if (!statSync(target).isDirectory()) throw new Error(`${target} is not a folder.`);
    if (!force && readdirSync(target).length > 0) throw new Error(`${target} is not empty; pass --force to write into it.`);
    return;
  }
  mkdirSync(target, { recursive: true });
};

type RunResult = { ok: boolean; output: string };

const run = (command: string, args: readonly string[], cwd: string): Promise<RunResult> =>
  new Promise((done, fail) => {
    const child = spawn(command, [...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", (error) => fail(error));
    child.on("close", (code) => done({ ok: code === 0, output }));
  });

const install = async (pm: PackageManager, target: string, log: (message: string) => void): Promise<void> => {
  if (pm === "pnpm") {
    log("Installing with pnpm");
    const offline = await run("pnpm", ["install", "--offline", "--ignore-workspace"], target);
    if (offline.ok) return;
    const online = await run("pnpm", ["install", "--ignore-workspace"], target);
    if (!online.ok) throw new Error(`pnpm install failed:\n${online.output || offline.output}`);
    return;
  }
  log("Installing with npm");
  const result = await run("npm", ["install"], target);
  if (!result.ok) throw new Error(`npm install failed:\n${result.output}`);
};

/**
 * After the install, a project that compiles with scriptc needs scriptc's own install step (it puts
 * the native compiler in place). Install scripts are off by default (`ignore-scripts`), so that one
 * step runs here, for scriptc alone; a compiler that still does not answer is an error.
 */
const finishScriptc = async (manifest: GeneratedManifest, pm: PackageManager, target: string, log: (message: string) => void): Promise<void> => {
  if (manifest.devDependencies["scriptc"] === undefined) return;
  const scriptc = join(target, "node_modules", ".bin", "scriptc");
  const answers = async (): Promise<boolean> => (await run(scriptc, ["--version"], target).catch(() => ({ ok: false, output: "" }))).ok;
  if (await answers()) return;
  log("Finishing scriptc's install");
  const rebuild = pm === "pnpm" ? await run("pnpm", ["--ignore-workspace", "rebuild", "scriptc", "--config.ignore-scripts=false"], target) : await run("npm", ["rebuild", "scriptc", "--ignore-scripts=false"], target);
  if (!rebuild.ok || !(await answers())) throw new Error(`scriptc's install step failed:\n${rebuild.output}`);
};

/** Generate a project: the manifest, the copied template, then the install unless it was turned off. */
export const generate = async (options: GenerateOptions): Promise<GeneratedManifest> => {
  const templateDir = join(here, "templates", options.kind.name);
  if (!existsSync(templateDir)) throw new Error(`The "${options.kind.name}" template is not here yet.`);
  ensureTarget(options.target, options.force);
  const manifest = manifestFor(options.kind, options.name, options.lightRoot, options.mode);
  const written = copyTemplate(templateDir, options.target, options.name, titleOf(options.name));
  writeFileSync(join(options.target, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  options.log?.(`Wrote ${String(written.length + 1)} files in ${options.target}`);
  if (options.install) {
    await install(options.pm, options.target, options.log ?? (() => undefined));
    await finishScriptc(manifest, options.pm, options.target, options.log ?? (() => undefined));
  }
  return manifest;
};
