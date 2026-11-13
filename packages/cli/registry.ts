/**
 * @file The commands, hooks and routes a CLI has: the static table, then what discovery loaded.
 * A static command wins a name; a discovered one with the same name warns and is dropped.
 */
import type { HookName, HookPayload, HookRun, HookTeardown } from "./index.ts";
import type { ArgsSchema, Command } from "./types/command.ts";
import type { Logger } from "./types/context.ts";
import type { Discovered, LoadedCommand, LoadedHook } from "./types/discovery.ts";
import type { Source } from "./types/discovery.ts";

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "an unknown error";
};

/**
 * What the static table and discovery contributed. Everything is already loaded, so the core
 * never imports a file.
 */
export class Registry {
  private readonly commands = new Map<string, LoadedCommand>();
  private readonly hooks = new Map<string, LoadedHook[]>();
  private readonly routes: unknown[] = [];
  private readonly log: Logger;

  constructor(name: string, staticCommands: Record<string, Command<ArgsSchema>>, discovered: Discovered, log: Logger) {
    this.log = log;
    const source: Source = { name, root: "" };
    for (const [commandName, command] of Object.entries(staticCommands)) this.commands.set(commandName, { command, source });
    for (const [commandName, record] of discovered.commands) {
      const existing = this.commands.get(commandName);
      if (existing) this.log.warn(`Command "${commandName}" already registered by ${existing.source.name}; ignoring duplicate from ${record.source.name}`);
      else this.commands.set(commandName, record);
    }
    for (const [hookName, handlers] of discovered.hooks) {
      const list = this.hooks.get(hookName) ?? [];
      for (const handler of handlers) list.push(handler);
      this.hooks.set(hookName, list);
    }
    for (const route of discovered.routes) this.routes.push(route.app);
  }

  hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  listCommandNames(): string[] {
    const names = new Set<string>(this.commands.keys());
    for (const record of this.commands.values()) if (record.command.aliases) for (const alias of record.command.aliases) names.add(alias);
    return [...names].sort();
  }

  /** The command by its name, or by an alias; null when nothing answers to it. */
  async loadCommand(name: string): Promise<LoadedCommand | null> {
    const direct = this.commands.get(name);
    if (direct) return direct;
    for (const [commandName, record] of this.commands) {
      if (commandName !== name && record.command.aliases && record.command.aliases.includes(name)) return record;
    }
    return null;
  }

  /** Every handler of a hook, in discovery order. */
  async loadHooks(name: HookName): Promise<LoadedHook[]> {
    return this.hooks.get(name) ?? [];
  }

  /**
   * Run every handler of a hook with the command's context. A handler that throws is warned with
   * its source and counted; the rest still run. Returned functions are teardowns, run last first.
   */
  async runHook<K extends HookName>(name: K, ctx: import("./types/context.ts").CommandContext, payload: HookPayload<K>): Promise<HookRun> {
    const teardowns: Array<{ fn: HookTeardown; source: Source }> = [];
    let ran = 0;
    let failed = 0;
    for (const { fn, source } of await this.loadHooks(name)) {
      ran += 1;
      try {
        const handler = fn as (context: import("./types/context.ts").CommandContext, value: unknown) => unknown;
        const result = await handler(ctx, payload);
        if (typeof result === "function") teardowns.push({ fn: result as HookTeardown, source });
      } catch (err) {
        failed += 1;
        ctx.log.warn(`[${name}] ${source.name}: ${messageOf(err)}`);
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
            ctx.log.warn(`[${name}] ${source.name} teardown: ${messageOf(err)}`);
          }
        }
      },
    };
  }

  /** Every route file's default export, in discovery order. */
  async loadRoutes(): Promise<readonly unknown[]> {
    return this.routes;
  }
}
