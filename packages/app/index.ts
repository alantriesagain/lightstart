/**
 * @file `@lightstart/app`: the few choices a project makes about its app.
 * `defineApp` keeps the config's literal types and adds the record the host
 * fills with the arguments it parsed; the host reads the rest of the wiring
 * from the project's folders.
 */

import type { ArgsSchema, ResolvedArgs } from "@lightstart/cli/types/command.ts";

/** The host an app runs on. */
export type AppHost = "web" | "tui";

/** Where an app keeps its rows. */
export type StorageKind = "indexeddb" | "jsonl" | "memory";

/** Where a database keeps its JSONL files: a folder, or one read from the parsed arguments. */
export type DirResolver = string | ((args: Record<string, unknown>) => string);

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
  /** The arguments the app takes; the host parses them and fills `args`. */
  args?: ArgsSchema;
}

/** What a running host adds to an app: restart it with other arguments, or quit it. */
export interface AppLifecycle {
  restart(args?: Record<string, unknown>): Promise<void>;
  quit(code?: number): Promise<void>;
}

type ArgsOf<C extends AppConfig> = C["args"] extends ArgsSchema ? C["args"] : Record<never, never>;

/** The app's config with its argument values and lifecycle calls. */
export type DefinedApp<C extends AppConfig> = Omit<C, "args"> & AppLifecycle & {
  /** The values the host parsed, empty until it does. */
  args: ResolvedArgs<ArgsOf<C>>;
  /** The argument schema, when the config declares one. */
  argsSchema?: ArgsSchema;
};

const notRunning = async (): Promise<void> => {
  throw new Error("the app is not running");
};

/** The app's config, typed and with the argument record its host fills in. */
export const defineApp = <C extends AppConfig>(config: C): DefinedApp<C> => {
  const defined = {
    ...config,
    args: {},
    argsSchema: config.args,
    restart: notRunning,
    quit: notRunning,
  };
  return defined as unknown as DefinedApp<C>;
};
