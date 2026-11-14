/**
 * @file What the tests share: a quiet logger, a logger that keeps its lines, an empty discovery
 * result, and a loader that answers the modules a test registered.
 */
import { FileLoader } from "../index.ts";
import type { CommandRecord, Discovered, HookRecord, Logger, Source } from "../index.ts";

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
  commands: new Map<string, CommandRecord>(),
  routes: [],
  hooks: new Map<string, HookRecord[]>(),
  extensions: new Map(),
  cliDir: "",
  loader: null,
});

export const source = (name: string): Source => ({ name, root: "" });

/** A loader whose imports answer what the test registered for each file. */
export class TestLoader extends FileLoader {
  readonly modules = new Map<string, unknown>();
  readonly loads: string[] = [];

  add(file: string, module: unknown): void {
    this.modules.set(file, module);
  }

  load(file: string): Promise<unknown> {
    this.loads.push(file);
    const found = this.modules.get(file);
    return Promise.resolve(found ?? {});
  }
}
