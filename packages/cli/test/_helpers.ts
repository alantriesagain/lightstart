/**
 * @file What the tests share: a quiet logger, a logger that keeps its lines, and an empty
 * discovery result.
 */
import type { Discovered, LoadedCommand, LoadedHook, Logger, Source } from "../index.ts";

export const silentLogger: Logger = {
  log: (): void => {},
  warn: (): void => {},
  error: (): void => {},
  debug: (): void => {},
};

export type CapturedLogger = Logger & { messages: Array<{ level: string; text: string }> };

export const captureLogger = (): CapturedLogger => {
  const messages: Array<{ level: string; text: string }> = [];
  return {
    messages,
    log: (...args: unknown[]): void => {
      messages.push({ level: "log", text: args.join(" ") });
    },
    warn: (...args: unknown[]): void => {
      messages.push({ level: "warn", text: args.join(" ") });
    },
    error: (...args: unknown[]): void => {
      messages.push({ level: "error", text: args.join(" ") });
    },
    debug: (...args: unknown[]): void => {
      messages.push({ level: "debug", text: args.join(" ") });
    },
  };
};

export const emptyDiscovered = (): Discovered => ({
  commands: new Map<string, LoadedCommand>(),
  routes: [],
  hooks: new Map<string, LoadedHook[]>(),
  cliDir: "",
});

export const source = (name: string): Source => ({ name, root: "" });
