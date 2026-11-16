/**
 * @file `@lightstart/app`: the few choices a project makes about its app.
 * `defineApp` makes the app from its config: one instance holding the
 * arguments the host parsed and the host's restart and quit. The host reads
 * the rest of the wiring from the project's folders. The app is a class, and
 * its arguments are read by name, so the instance a controller imports is the
 * one the host writes, natively as under node.
 */

import type { ArgsSchema } from "@lightstart/cli/types/command.ts";

/** The host an app runs on. */
export type AppHost = "web" | "tui";

/** Where an app keeps its rows. */
export type StorageKind = "indexeddb" | "jsonl" | "memory";

/** Where a database keeps its JSONL files: a folder, or one read from the parsed arguments. */
export type DirResolver = string | ((args: AppArgs) => string);

/** Another database the store routes models to through their schema's `$adapter`. */
export interface DatabaseConfig {
  kind: "jsonl" | "memory";
  dir?: DirResolver;
}

/** The store an app opens. `name` defaults to the app's name; a JSONL store also takes a folder. */
export interface StorageConfig {
  kind: StorageKind;
  name?: string;
  dir?: DirResolver;
  databases?: Record<string, DatabaseConfig>;
}

/** What `src/app.ts` declares: the few choices a project makes. */
export interface AppConfig {
  /** The app's name, used as the store's database name and the document title. */
  name: string;
  /** The host the generated entry starts. */
  host: AppHost;
  /** A theme preset name; `"default"` when absent. */
  theme?: string;
  /** The store to open; IndexedDB on the web and JSONL files on the terminal when absent. */
  storage?: StorageConfig;
  /** The root view's tag; `"app-root"` when absent. */
  root?: string;
  /** The arguments the app takes; the host parses them into `args`. */
  args?: ArgsSchema;
}

/** The arguments the host parsed, read by name: empty until a host runs the app. */
export class AppArgs {
  /** Every value by its name, as the parser resolved it. */
  values: Record<string, unknown> = {};

  /** An option's value, or `undefined` when it was not given and has no default. */
  string(name: string): string | undefined {
    const value = this.values[name];
    return typeof value === "string" ? value : undefined;
  }

  /** Whether a flag is on. */
  flag(name: string): boolean {
    return this.values[name] === true;
  }

  /** A positional that takes the rest, empty when none was given. */
  list(name: string): string[] {
    const value = this.values[name];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }
}

/** What a running host installs on its app: start it again with other arguments, or quit it. */
export interface AppLifecycle {
  restart(args?: Record<string, unknown>): Promise<void>;
  quit(code?: number): Promise<void>;
}

/**
 * The app `src/app.ts` default-exports: its config, the arguments its host
 * parsed and the host's lifecycle calls. It is one instance every module
 * shares, the generated manifest and a controller that imports it alike.
 */
export class App {
  readonly name: string;
  readonly host: AppHost;
  readonly theme: string | undefined;
  readonly storage: StorageConfig | undefined;
  readonly root: string | undefined;
  /** The argument schema the config declares; empty when it declares none. */
  readonly argsSchema: ArgsSchema;
  /** The values the host parsed. */
  readonly args = new AppArgs();
  /** The running host's calls; null until a host runs the app. */
  lifecycle: AppLifecycle | null = null;

  constructor(config: AppConfig) {
    this.name = config.name;
    this.host = config.host;
    this.theme = config.theme;
    this.storage = config.storage;
    this.root = config.root;
    this.argsSchema = config.args ?? {};
  }

  /** Stop the controllers and the store, then open them again with `args` merged over the current ones. */
  restart(args?: Record<string, unknown>): Promise<void> {
    if (this.lifecycle === null) return Promise.reject(new Error("the app is not running"));
    return this.lifecycle.restart(args);
  }

  /** Stop the renderer, the controllers and the store, then exit with `code`. */
  quit(code?: number): Promise<void> {
    if (this.lifecycle === null) return Promise.reject(new Error("the app is not running"));
    return this.lifecycle.quit(code);
  }
}

/** The app of the config `src/app.ts` declares. */
export const defineApp = (config: AppConfig): App => new App(config);
