/**
 * @file The commands, hooks, routes and extensions a CLI has: the static table, then the files
 * discovery listed. A file is imported only when it is needed. A static command wins a name; a
 * discovered one with the same name warns and is dropped.
 */
import type { HookName, HookPayload, HookRun, HookTeardown } from "./index.ts";
import type { ArgsSchema, Command } from "./types/command.ts";
import type { CommandContext, Logger } from "./types/context.ts";
import type {
  CommandRecord,
  Discovered,
  ExtensionRecord,
  FileLoader,
  HookRecord,
  LoadedCommand,
  LoadedExtension,
  LoadedHook,
  RouteRecord,
  Source,
} from "./types/discovery.ts";
import type { ExtensionDefinition } from "./types/extension.ts";

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "an unknown error";
};

/** A command file the run needs could not be imported. */
export class LoadError extends Error {}

/**
 * What the static table and discovery contributed. Commands, hooks, routes and extensions are
 * listed up front and imported the first time each is needed.
 */
export class Registry {
  private readonly staticCommands = new Map<string, LoadedCommand>();
  private readonly commands: Map<string, CommandRecord>;
  private readonly hooks: Map<string, HookRecord[]>;
  private readonly routes: RouteRecord[];
  private readonly extensions: Map<string, ExtensionRecord[]>;
  private readonly loadedCommands = new Map<string, LoadedCommand | null>();
  private readonly loadedHooks = new Map<string, LoadedHook[]>();
  private readonly loadedExtensions = new Map<string, LoadedExtension[]>();
  private readonly loadedRoutes: unknown[] = [];
  private routesLoaded = false;
  private readonly loader: FileLoader | null;
  private readonly log: Logger;

  constructor(name: string, staticCommands: Record<string, Command<ArgsSchema>>, discovered: Discovered, log: Logger) {
    this.log = log;
    this.loader = discovered.loader;
    this.commands = discovered.commands;
    this.hooks = discovered.hooks;
    this.routes = discovered.routes;
    this.extensions = discovered.extensions;
    const source: Source = { name, root: "" };
    for (const [commandName, command] of Object.entries(staticCommands)) this.staticCommands.set(commandName, { command, source, name: commandName });
    for (const commandName of discovered.commands.keys()) {
      if (!this.staticCommands.has(commandName)) continue;
      const existing = this.staticCommands.get(commandName)!;
      const record = discovered.commands.get(commandName)!;
      this.log.warn(`Command "${commandName}" already registered by ${existing.source.name}; ignoring duplicate from ${record.source.name}`);
    }
  }

  /** Report an error through the logger this registry was built with. */
  error(message: string): void {
    this.log.error(message);
  }

  hasCommand(name: string): boolean {
    return this.staticCommands.has(name) || this.commands.has(name);
  }

  listCommandNames(): string[] {
    const names = new Set<string>(this.staticCommands.keys());
    for (const record of this.staticCommands.values()) if (record.command.aliases) for (const alias of record.command.aliases) names.add(alias);
    for (const name of this.commands.keys()) names.add(name);
    return [...names].sort();
  }

  /** The command by its name, or by an alias; null when nothing answers to it. */
  async loadCommand(name: string): Promise<LoadedCommand | null> {
    const direct = this.staticCommands.get(name);
    if (direct) return direct;
    const record = this.commands.get(name);
    if (record) return await this.importCommand(name, record);
    return await this.loadByAlias(name);
  }

  /** Load a command for help: a file that fails to import is warned and skipped. */
  async loadCommandForHelp(name: string): Promise<LoadedCommand | null> {
    try {
      return await this.loadCommand(name);
    } catch (err) {
      this.log.warn(messageOf(err));
      return null;
    }
  }

  private async loadByAlias(name: string): Promise<LoadedCommand | null> {
    for (const record of this.staticCommands.values()) {
      if (record.command.aliases && record.command.aliases.includes(name)) return record;
    }
    for (const [commandName, record] of this.commands) {
      if (commandName === name) continue;
      let loaded: LoadedCommand | null;
      try {
        loaded = await this.importCommand(commandName, record);
      } catch {
        continue;
      }
      if (loaded && loaded.command.aliases && loaded.command.aliases.includes(name)) return loaded;
    }
    return null;
  }

  private async importCommand(name: string, record: CommandRecord): Promise<LoadedCommand | null> {
    if (this.loadedCommands.has(name)) return this.loadedCommands.get(name) ?? null;
    if (this.loader === null) throw new LoadError(`Command "${name}" at ${record.file} cannot load: this CLI has no file loader`);
    let mod: { default?: unknown };
    try {
      mod = (await this.loader.load(record.file)) as { default?: unknown };
    } catch (err) {
      throw new LoadError(`Command "${name}" at ${record.file} failed to load: ${messageOf(err)}`);
    }
    const definition = mod.default;
    if (definition === null || typeof definition !== "object") {
      this.log.warn(`Command "${name}" at ${record.file} must export a default Command with a run() method`);
      this.loadedCommands.set(name, null);
      return null;
    }
    const run = (definition as { run?: unknown }).run;
    if (typeof run !== "function") {
      this.log.warn(`Command "${name}" at ${record.file} must export a default Command with a run() method`);
      this.loadedCommands.set(name, null);
      return null;
    }
    const loaded: LoadedCommand = { command: definition as Command<ArgsSchema>, source: record.source, name };
    this.loadedCommands.set(name, loaded);
    return loaded;
  }

  /** Every handler of a hook, in discovery order, imported on the first dispatch. */
  async loadHooks(name: HookName): Promise<LoadedHook[]> {
    const key = name as string;
    const cached = this.loadedHooks.get(key);
    if (cached) return cached;
    const list: LoadedHook[] = [];
    for (const record of this.hooks.get(key) ?? []) {
      if (this.loader === null) break;
      let mod: { default?: unknown };
      try {
        mod = (await this.loader.load(record.file)) as { default?: unknown };
      } catch (err) {
        this.log.warn(`Hook ${key} from ${record.source.name} failed to load: ${messageOf(err)}`);
        continue;
      }
      if (typeof mod.default !== "function") {
        this.log.warn(`Hook ${key} from ${record.source.name} exports no function`);
        continue;
      }
      list.push({ fn: mod.default, source: record.source });
    }
    this.loadedHooks.set(key, list);
    return list;
  }

  /** Every extension of a command, in discovery order, imported on the first need. */
  async loadExtensions(commandName: string): Promise<LoadedExtension[]> {
    const cached = this.loadedExtensions.get(commandName);
    if (cached) return cached;
    const list: LoadedExtension[] = [];
    for (const record of this.extensions.get(commandName) ?? []) {
      if (this.loader === null) break;
      let mod: { default?: unknown };
      try {
        mod = (await this.loader.load(record.file)) as { default?: unknown };
      } catch (err) {
        this.log.warn(`Extension ${record.command} from ${record.source.name} failed to load: ${messageOf(err)}`);
        continue;
      }
      const definition = mod.default;
      if (definition === null || typeof definition !== "object") {
        this.log.warn(`Extension ${record.command} from ${record.source.name} must default-export defineExtension()`);
        continue;
      }
      const typed = definition as { command?: unknown; setup?: unknown };
      if (typeof typed.setup !== "function" || typeof typed.command !== "string") {
        this.log.warn(`Extension ${record.command} from ${record.source.name} must default-export defineExtension()`);
        continue;
      }
      if (typed.command !== record.command) {
        this.log.warn(`Extension at ${record.file} from ${record.source.name} names "${typed.command}" but its file names "${record.command}"`);
        continue;
      }
      list.push({ extension: definition as ExtensionDefinition, source: record.source });
    }
    this.loadedExtensions.set(commandName, list);
    return list;
  }

  /**
   * Run every handler of a hook with the command's context. A handler that throws is warned with
   * its source and counted; the rest still run. Returned functions are teardowns, run last first.
   */
  async runHook<K extends HookName>(name: K, ctx: CommandContext, payload: HookPayload<K>): Promise<HookRun> {
    const teardowns: Array<{ fn: HookTeardown; source: Source }> = [];
    let ran = 0;
    let failed = 0;
    for (const { fn, source } of await this.loadHooks(name)) {
      ran += 1;
      try {
        const handler = fn as (context: CommandContext, value: unknown) => unknown;
        const result = await handler(ctx, payload);
        if (typeof result === "function") teardowns.push({ fn: result as HookTeardown, source });
      } catch (err) {
        failed += 1;
        ctx.log.warn(`[${String(name)}] ${source.name}: ${messageOf(err)}`);
      }
    }
    return {
      ran,
      failed,
      teardown: async (): Promise<void> => {
        for (let i = teardowns.length - 1; i >= 0; i--) {
          const { fn, source } = teardowns[i]!;
          try {
            await fn();
          } catch (err) {
            ctx.log.warn(`[${String(name)}] ${source.name} teardown: ${messageOf(err)}`);
          }
        }
      },
    };
  }

  /** Every route file's default export, in discovery order, imported on the first call. */
  async loadRoutes(): Promise<readonly unknown[]> {
    if (this.routesLoaded) return this.loadedRoutes;
    for (const record of this.routes) {
      if (this.loader === null) break;
      try {
        const mod = (await this.loader.load(record.file)) as { default?: unknown };
        if (typeof mod.default === "function") this.loadedRoutes.push(mod.default);
        else this.log.warn(`Route file ${record.file} from ${record.source.name} default-exports no function`);
      } catch (err) {
        this.log.warn(`Route file ${record.file} from ${record.source.name} failed to load: ${messageOf(err)}`);
      }
    }
    this.routesLoaded = true;
    return this.loadedRoutes;
  }
}
