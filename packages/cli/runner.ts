/**
 * @file Run one command: parse its argv, build its context, and answer an exit code. Unknown
 * command 1, an argument error 2 with its usage, a thrown error 1.
 */
import { ArgError, parseArgs } from "./argv.ts";
import { formatBytes } from "./format.ts";
import { logicalCwd } from "./env.ts";
import { createLogger } from "./log.ts";
import type { ArgsSchema, ResolvedArgs } from "./types/command.ts";
import type { CliApi, CommandContext, LogLevel } from "./types/context.ts";
import type { HookName, HookPayload } from "./index.ts";
import type { Registry } from "./registry.ts";

export type RunOptions = {
  name: string;
  projectDir: string;
  cliDir: string;
  registry: Registry;
  level?: LogLevel;
};

const buildCli = (
  registry: Registry,
  run: (name: string, args?: readonly string[]) => Promise<number>,
  context: () => CommandContext,
): CliApi => ({
  runCommand: run,
  runHook: <K extends HookName>(name: K, payload: HookPayload<K>) => registry.runHook(name, context(), payload),
  listCommands: () => registry.listCommandNames(),
  loadRoutes: async () => await registry.loadRoutes(),
});

/** The context a command runs with; its `cli.runHook` hands this same context to the handlers. */
export const buildContext = (
  opts: RunOptions,
  registry: Registry,
  run: (name: string, args?: readonly string[]) => Promise<number>,
  argv: readonly string[],
  prefix?: string,
): CommandContext => {
  const ctx: CommandContext = {
    projectDir: opts.projectDir,
    cliDir: opts.cliDir,
    cwd: logicalCwd(),
    argv,
    log: createLogger(prefix, opts.level),
    env: process.env,
    cli: buildCli(registry, run, () => ctx),
    formatBytes,
  };
  return ctx;
};

/** Run `name` with `argv`, answering the process exit code. */
export const runCommand = async (name: string, argv: readonly string[], opts: RunOptions): Promise<number> => {
  const record = await opts.registry.loadCommand(name);
  if (!record) {
    const log = createLogger(undefined, opts.level);
    log.error(`Unknown command: ${name}`);
    log.log(`Run "${opts.name} --help" to see available commands.`);
    return 1;
  }

  const { command, source } = record;
  let parsed: ResolvedArgs<ArgsSchema>;
  try {
    parsed = parseArgs(command.args ?? {}, argv);
  } catch (err) {
    const log = createLogger(undefined, opts.level);
    if (err instanceof ArgError) {
      log.error(err.message);
      if (command.usage) log.log(`Usage: ${command.usage}`);
      return 2;
    }
    throw err;
  }

  const ctx = buildContext(
    opts,
    opts.registry,
    (inner: string, args: readonly string[] = []): Promise<number> => runCommand(inner, args, opts),
    argv,
    source.name === "<project>" || source.root === "" ? undefined : source.name,
  );

  try {
    const result = await command.run(ctx, parsed);
    return typeof result === "number" ? result : 0;
  } catch (err) {
    if (err instanceof Error) ctx.log.error(err.stack ?? err.message);
    else ctx.log.error(typeof err === "string" ? err : "an unknown error");
    return 1;
  }
};
