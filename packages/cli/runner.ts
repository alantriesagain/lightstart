/**
 * @file Run one command: load its extensions, merge their args into its schema, parse its argv,
 * build its context, and answer an exit code. Unknown command 1, an argument error 2 with its
 * usage, a thrown error 1.
 */
import { ArgError, parseArgs } from "./argv.ts";
import { formatBytes } from "./format.ts";
import { logicalCwd } from "./env.ts";
import { createLogger } from "./log.ts";
import type { ArgsSchema, ArgSpec, ResolvedArgs } from "./types/command.ts";
import type { CliApi, CommandContext, LogLevel } from "./types/context.ts";
import type { HookName, HookPayload } from "./index.ts";
import type { LoadedExtension } from "./types/discovery.ts";
import type { ExtensionApi, Extensions } from "./types/extension.ts";
import type { Registry } from "./registry.ts";

export type RunOptions = {
  name: string;
  projectDir: string;
  cliDir: string;
  registry: Registry;
  level?: LogLevel;
};

type SetupState = { failed: boolean };

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : typeof err === "string" ? err : "an unknown error");

const runExtensions = async (
  commandName: string,
  extensions: readonly LoadedExtension[],
  ctx: CommandContext,
  args: Record<string, unknown>,
  api: unknown,
): Promise<void> => {
  for (const { extension, source } of extensions) {
    try {
      const setup = extension.setup as unknown as (ctx: CommandContext, args: Record<string, unknown>, api: unknown) => Promise<void> | void;
      await setup(ctx, args, api);
    } catch (err) {
      throw new Error(`Extension ${source.name} failed for "${commandName}": ${messageOf(err)}`);
    }
  }
};

const buildCli = (
  registry: Registry,
  run: (name: string, args?: readonly string[]) => Promise<number>,
  context: () => CommandContext,
  commandName: string,
  extensions: readonly LoadedExtension[],
  args: Record<string, unknown>,
  setup: SetupState,
): CliApi => ({
  runCommand: run,
  runHook: <K extends HookName>(name: K, payload: HookPayload<K>) => registry.runHook(name, context(), payload),
  listCommands: () => registry.listCommandNames(),
  loadRoutes: async () => await registry.loadRoutes(),
  extend: async <K extends keyof Extensions>(_name: K, api: ExtensionApi<K>): Promise<void> => {
    try {
      await runExtensions(commandName, extensions, context(), args, api);
    } catch (err) {
      setup.failed = true;
      throw err;
    }
  },
});

type Built = { ctx: CommandContext; setup: SetupState };

const makeContext = (
  opts: RunOptions,
  registry: Registry,
  run: (name: string, args?: readonly string[]) => Promise<number>,
  argv: readonly string[],
  prefix: string | undefined,
  commandName: string,
  extensions: readonly LoadedExtension[],
  args: Record<string, unknown>,
): Built => {
  const setup: SetupState = { failed: false };
  const ctx: CommandContext = {
    projectDir: opts.projectDir,
    cliDir: opts.cliDir,
    cwd: logicalCwd(),
    argv,
    log: createLogger(prefix, opts.level),
    env: process.env,
    cli: buildCli(registry, run, () => ctx, commandName, extensions, args, setup),
    formatBytes,
  };
  return { ctx, setup };
};

/** The context a command runs with; its `cli.runHook` hands this same context to the handlers. */
export const buildContext = (
  opts: RunOptions,
  registry: Registry,
  run: (name: string, args?: readonly string[]) => Promise<number>,
  argv: readonly string[],
  prefix?: string,
): CommandContext => makeContext(opts, registry, run, argv, prefix, "", [], {}).ctx;

const mergeArgs = (base: ArgsSchema, extensions: readonly LoadedExtension[], commandSource: string): { schema: ArgsSchema; error: string } => {
  const schema: Record<string, ArgSpec> = {};
  const owners = new Map<string, string>();
  for (const [key, spec] of Object.entries(base)) {
    schema[key] = spec;
    owners.set(key, commandSource);
  }
  for (const { extension, source } of extensions) {
    if (!extension.args) continue;
    for (const [key, spec] of Object.entries(extension.args)) {
      const existing = owners.get(key);
      if (existing !== undefined) return { schema, error: `Argument "${key}" from ${source.name} is already declared by ${existing}` };
      schema[key] = spec;
      owners.set(key, source.name);
    }
  }
  return { schema, error: "" };
};

/** Run `name` with `argv`, answering the process exit code. */
export const runCommand = async (name: string, argv: readonly string[], opts: RunOptions): Promise<number> => {
  let record;
  try {
    record = await opts.registry.loadCommand(name);
  } catch (err) {
    opts.registry.error(messageOf(err));
    return 1;
  }
  if (!record) {
    const log = createLogger(undefined, opts.level);
    log.error(`Unknown command: ${name}`);
    log.log(`Run "${opts.name} --help" to see available commands.`);
    return 1;
  }

  const { command, source } = record;
  const extensions = await opts.registry.loadExtensions(record.name);
  const merged = mergeArgs(command.args ?? {}, extensions, source.name);
  if (merged.error !== "") {
    const log = createLogger(undefined, opts.level);
    log.error(merged.error);
    if (command.usage) log.log(`Usage: ${command.usage}`);
    return 2;
  }

  let parsed: ResolvedArgs<ArgsSchema>;
  try {
    parsed = parseArgs(merged.schema, argv);
  } catch (err) {
    const log = createLogger(undefined, opts.level);
    if (err instanceof ArgError) {
      log.error(err.message);
      if (command.usage) log.log(`Usage: ${command.usage}`);
      return 2;
    }
    throw err;
  }

  const built = makeContext(
    opts,
    opts.registry,
    (inner: string, args: readonly string[] = []): Promise<number> => runCommand(inner, args, opts),
    argv,
    source.name === "<project>" || source.root === "" ? undefined : source.name,
    name,
    extensions,
    parsed as Record<string, unknown>,
  );

  try {
    const result = await command.run(built.ctx, parsed);
    if (built.setup.failed) return 1;
    return typeof result === "number" ? result : 0;
  } catch (err) {
    if (err instanceof Error) built.ctx.log.error(err.stack ?? err.message);
    else built.ctx.log.error(typeof err === "string" ? err : "an unknown error");
    return 1;
  }
};
