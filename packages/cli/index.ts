/**
 * @file `@lightstart/cli`: a command runner whose commands come from a static table and from
 * `cli/` folders, with hooks, routes and a native-compilable core.
 */
import { ArgError, SchemaError, parseArgs } from "./argv.ts";
import { loadEnv, logicalCwd } from "./env.ts";
import { formatBytes } from "./format.ts";
import { hookNameOf } from "./hooks.ts";
import { renderHelp } from "./help.ts";
import { createLogger, resolveLevel } from "./log.ts";
import { LoadError, Registry } from "./registry.ts";
import { buildContext, runCommand } from "./runner.ts";
import type { RunOptions } from "./runner.ts";
import { defineCommand } from "./types/command.ts";
import type { ArgsSchema, ArgSpec, Command, ResolvedArgs } from "./types/command.ts";
import type { CliApi, CommandContext, Logger, LogLevel } from "./types/context.ts";
import type { CommandRecord, Discovered, Discoverer, DiscoverOptions, ExtensionRecord, HookRecord, ListedModule, LoadedCommand, LoadedExtension, LoadedHook, LoadedRoute, RouteRecord, Source } from "./types/discovery.ts";
import { FileLoader } from "./types/discovery.ts";
import { defineExtension } from "./types/extension.ts";
import type { Extension, ExtensionApi, ExtensionDefinition, ExtensionSetup, Extensions } from "./types/extension.ts";

export type { ArgsSchema, ArgSpec, CliApi, Command, CommandContext, CommandRecord, Discovered, Discoverer, DiscoverOptions, Extension, ExtensionApi, ExtensionDefinition, ExtensionRecord, ExtensionSetup, Extensions, HookRecord, ListedModule, LoadedCommand, LoadedExtension, LoadedHook, LoadedRoute, Logger, LogLevel, ResolvedArgs, RouteRecord, Source, RunOptions };
export { ArgError, FileLoader, LoadError, SchemaError, Registry, buildContext, createLogger, defineCommand, defineExtension, formatBytes, loadEnv, logicalCwd, parseArgs, renderHelp, resolveLevel, runCommand, hookNameOf };

/** What a hook answers to be run at shutdown. */
export type HookTeardown = () => Promise<void> | void;

/**
 * The hooks a package's `cli/hooks/<name>.ts` can answer to, named by file (`serve.after.ts` is
 * `serve:after`). A package that adds hooks extends this interface by declaration merging.
 */
export interface Hooks {}

export type HookName = keyof Hooks extends never ? string : keyof Hooks;

export type HookPayload<K extends HookName> = K extends keyof Hooks ? Parameters<Hooks[K]>[1] : unknown;

/** What one dispatch did: every handler ran, failures were counted, teardowns collected. */
export type HookRun = {
  ran: number;
  failed: number;
  /** Run the collected teardowns, last registered first, each isolated. */
  teardown(): Promise<void>;
};

/** What `createCli` needs: the command's name and version, its scopes, and how it discovers files. */
export type CreateCliOptions = {
  name: string;
  version: string;
  scopes: readonly string[];
  envPrefix: string;
  commands?: Record<string, Command<ArgsSchema>>;
  packages?: readonly string[];
  discover?: Discoverer;
};

export type Globals = { level?: LogLevel; help: boolean; version: boolean; argv: string[] };

/** The CLI `createCli` builds: `main` runs one argv and answers the exit code. */
export type Cli = {
  main(rawArgv?: readonly string[], out?: (text: string) => void): Promise<number>;
};

const LEVEL_FLAGS: Record<string, LogLevel> = { "--quiet": "error", "--verbose": "debug", "--debug": "debug" };

/**
 * Split the global flags out of an argv: `--quiet`, `--verbose`, `--debug`, `--help`/`-h` and
 * `--version`/`-v` anywhere before a `--`; everything else, and everything after `--`, stays for
 * the command.
 */
export const splitGlobals = (rawArgv: readonly string[]): Globals => {
  const out: Globals = { level: undefined, help: false, version: false, argv: [] };
  let passthrough = false;
  for (const arg of rawArgv) {
    if (passthrough) {
      out.argv.push(arg);
      continue;
    }
    if (arg === "--") {
      passthrough = true;
      out.argv.push(arg);
      continue;
    }
    const level = LEVEL_FLAGS[arg];
    if (level) out.level = level;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--version" || arg === "-v") out.version = true;
    else out.argv.push(arg);
  }
  return out;
};

const emptyDiscovered = (): Discovered => ({
  commands: new Map<string, CommandRecord>(),
  routes: [],
  hooks: new Map<string, HookRecord[]>(),
  extensions: new Map<string, ExtensionRecord[]>(),
  cliDir: "",
  loader: null,
});

/**
 * Build a CLI: env, globals, discovery, then help, version or the command. The project folder is
 * `<envPrefix>_PROJECT_DIR`, else the shell's logical working directory.
 */
export const createCli = (options: CreateCliOptions): Cli => ({
  main: async (rawArgv: readonly string[] = process.argv.slice(2), out: (text: string) => void = (text: string): void => console.log(text)): Promise<number> => {
    const projectDir = process.env[`${options.envPrefix}_PROJECT_DIR`] ?? logicalCwd();
    loadEnv(projectDir);
    const globals = splitGlobals(rawArgv);
    const level = resolveLevel(globals.level, options.envPrefix);
    const log = createLogger(undefined, level);

    if (globals.version) {
      out(options.version);
      return 0;
    }

    const discovered = options.discover
      ? await options.discover({ projectDir, scopes: options.scopes, packages: options.packages ?? [], log })
      : emptyDiscovered();
    const registry = new Registry(options.name, options.commands ?? {}, discovered, log);
    const [first, ...rest] = globals.argv;

    if (globals.help || first === undefined) {
      out(await renderHelp(registry, options.name, first));
      return 0;
    }

    return await runCommand(first, rest, { name: options.name, projectDir, cliDir: discovered.cliDir, registry, level });
  },
});
