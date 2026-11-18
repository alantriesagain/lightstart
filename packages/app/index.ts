/**
 * @file `@lightstart/app`: the few choices a project makes about its app, the
 * same whatever it runs on. `defineApp` makes the app from its config: one
 * instance holding the arguments its host filled and the run's restart and
 * quit. The run (run.ts) opens its stores, starts its controllers and its
 * routes, and a host (`@lightstart/app/web`, `@lightstart/app/tui`) puts it on
 * its surface. The app is a class, and its arguments are read by name, so the
 * instance a controller imports is the one the host writes, natively as under
 * node.
 */

import type { ArgsSchema } from "@lightstart/cli/types/command.ts";

/** Where a store keeps its rows, as its kind takes it: a folder, a file, a database's name; or one read from the parsed arguments. */
export type StoreAt = string | ((args: AppArgs) => string);

/** A store's kind, or one read from the parsed arguments (memory for a run that keeps nothing, say). */
export type StoreKindOf = string | ((args: AppArgs) => string);

/**
 * One store an app keeps rows in. `kind` is an adapter its host can run (`memory`, `indexeddb`,
 * `jsonl`, `sql`, or one the project registers), the host's default when absent; `at` is what that
 * kind opens. Either may be a function of the arguments.
 */
export interface StoreConfig {
  kind?: StoreKindOf;
  at?: StoreAt;
}

/** What `src/app.ts` declares: the few choices a project makes. */
export interface AppConfig {
  /** The app's name, used as its stores' default name and the document title. */
  name: string;
  /** The host the generated entry starts: `@lightstart/app/<host>` (`web`, `tui`). */
  host: string;
  /** A theme preset name; `"default"` when absent. */
  theme?: string;
  /** The default language the app's words are in; `"en"` when absent. */
  locale?: string;
  /** The site's address, absolute and without a trailing slash (`https://lightstart.dev`); the build writes its sitemap against it. */
  url?: string;
  /** Render every concrete route to its own `index.html` at build time; `light build --prerender` when absent. */
  prerender?: boolean;
  /**
   * The stores by name, several at once of any kinds the host runs; a model picks one with its
   * schema's `$adapter`, and gets `main` when it names none. `main` is the host's default kind when
   * the app declares no store of that name.
   */
  stores?: Record<string, StoreConfig>;
  /** The root view's tag; `"app-root"` when absent. */
  root?: string;
  /** The arguments the app takes; the host fills them from its source (argv, the URL) into `args`. */
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
  readonly host: string;
  readonly theme: string | undefined;
  /** The default language the app's words are in. */
  readonly locale: string;
  /** The site's address, when the config names one, without a trailing slash. */
  readonly url: string | undefined;
  /** Whether the build renders every concrete route ahead of time. */
  readonly prerender: boolean;
  /** The stores the config declares, `main` among them (of the host's default kind unless it says). */
  readonly stores: Record<string, StoreConfig>;
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
    this.locale = config.locale ?? "en";
    this.url = config.url === undefined ? undefined : config.url.replace(/\/+$/, "");
    this.prerender = config.prerender === true;
    const stores: Record<string, StoreConfig> = {};
    stores["main"] = {};
    const declared = config.stores ?? {};
    for (const name of Object.keys(declared)) stores[name] = declared[name] ?? {};
    this.stores = stores;
    this.root = config.root;
    this.argsSchema = config.args ?? {};
  }

  /** Stop the run (its controllers, its stores, its view), then start it again with `args` merged over the current ones. */
  restart(args?: Record<string, unknown>): Promise<void> {
    if (this.lifecycle === null) return Promise.reject(new Error("the app is not running"));
    return this.lifecycle.restart(args);
  }

  /** Stop the run, then leave as the host does (a terminal app exits with `code`). */
  quit(code?: number): Promise<void> {
    if (this.lifecycle === null) return Promise.reject(new Error("the app is not running"));
    return this.lifecycle.quit(code);
  }
}

/** The app of the config `src/app.ts` declares. */
export const defineApp = (config: AppConfig): App => new App(config);
