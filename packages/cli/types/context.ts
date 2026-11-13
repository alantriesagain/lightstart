/**
 * @file What a command receives: the logger, the folders it runs in, its argv and the CLI API it
 * can call back into.
 */
import type { HookName, HookPayload, HookRun } from "../index.ts";
import type { ExtensionApi, Extensions } from "./extension.ts";

export type LogLevel = "debug" | "log" | "warn" | "error" | "silent";

export type Logger = {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
};

export type CliApi = {
  runCommand(name: string, args?: readonly string[]): Promise<number>;
  /** Run every discovered handler of a hook with this command's context. */
  runHook<K extends HookName>(name: K, payload: HookPayload<K>): Promise<HookRun>;
  listCommands(): readonly string[];
  /** Every loaded route file's default export, in discovery order. */
  loadRoutes(): Promise<readonly unknown[]>;
  /** Run every extension of this command, handing each `api`; a no-op when none extends it. */
  extend<K extends keyof Extensions>(name: K, api: ExtensionApi<K>): Promise<void>;
};

export type CommandContext = {
  projectDir: string;
  cliDir: string;
  cwd: string;
  argv: readonly string[];
  log: Logger;
  env: NodeJS.ProcessEnv;
  cli: CliApi;
  /** Format a byte count as `"1.5 MB"`. */
  formatBytes(bytes: number | undefined | null): string;
};
