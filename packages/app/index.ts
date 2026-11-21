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
import { appBase } from "./base.ts";

/** Where a store keeps its rows, as its adapter takes it: a folder, a file, a database's name; or one read from the parsed arguments. */
export type StoreAt = string | ((args: AppArgs) => string);

/** A store's adapter, or one read from the parsed arguments (memory for a run that keeps nothing, say). */
export type StoreAdapterOf = string | ((args: AppArgs) => string);

/** How the build renders a prerendered page: light's markup host in node, or headless Chromium through Playwright. */
export type PrerenderRenderer = "markup" | "browser";

/**
 * One store an app keeps rows in. `adapter` is an adapter type its host can run (`memory`, `indexeddb`,
 * `jsonl`, `sql`, or one the project registers), the host's default when absent; `at` is what that
 * adapter opens. Either may be a function of the arguments.
 */
export interface StoreConfig {
  adapter?: StoreAdapterOf;
  at?: StoreAt;
  /** Open the store in a worker the web host spawns; a host without one ignores it. */
  worker?: boolean;
}

/** What `src/app.ts` declares: the few choices a project makes. */
export interface AppConfig {
  /** The app's name, used as its stores' default name and the document title. */
  name: string;
  /** The host the generated entry starts: `@lightstart/app/<host>` (`web`, `tui`). */
  host: string;
  /**
   * The site's display name, the suffix of every page title (`<page> · <title>`, the home page
   * or a page without a title the title alone). Without it the document title is the page's title
   * and the app's `name` with ` | ` between them, as before.
   */
  title?: string;
  /** A theme preset name; `"default"` when absent. */
  theme?: string;
  /** The page's color scheme: `"dark"` or `"light"` pins it, `"system"` follows the reader's preference; `"system"` when absent. */
  scheme?: "dark" | "light" | "system";
  /** The default language the app's words are in; `"en"` when absent. */
  locale?: string;
  /**
   * The Iconify set the app's icons come from, installed as `@iconify-json/<set>`; `"lucide"` when
   * absent. The generation writes each name its sources use into `.light/icons.css`.
   */
  icons?: string;
  /** The site's address, absolute and without a trailing slash (`https://lightstart.dev`); the build writes its sitemap against it, and its path is the base the app is served under. */
  url?: string;
  /** The path the app lives under (`/budget` for `https://user.github.io/budget`), overriding the path `url` names; `"/"` means the root. */
  base?: string;
  /** Render every concrete route to its own `index.html` at build time; `light build --prerender` when absent. `true` and `"markup"` render in node, `"browser"` through Playwright. */
  prerender?: boolean | PrerenderRenderer;
  /**
   * Run the whole model layer in one web worker: every declared store opens there, and the page reaches
   * it over `@lightstart/rpc`; `false` when absent, opening the stores on the page. A host without a
   * worker ignores it.
   */
  worker?: boolean;
  /** Run every route change inside the browser's view transition where it has one; `false` when absent. */
  transitions?: boolean;
  /** Move focus to the new view's heading after a route change; `true` when absent. */
  focusOnNavigate?: boolean;
  /**
   * The stores by name, several at once of any adapter types the host runs; a model picks one with its
   * schema's `$store`, and gets `main` when it names none. `main` is the host's default adapter when
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
  /** The site's display name, when the config names one. */
  readonly title: string | undefined;
  readonly theme: string | undefined;
  /** The page's color scheme: `"dark"`, `"light"` or `"system"`. */
  readonly scheme: "dark" | "light" | "system";
  /** The default language the app's words are in. */
  readonly locale: string;
  /** The Iconify set the app's icons come from, `"lucide"` when the config names none. */
  readonly icons: string;
  /** The site's address, when the config names one, without a trailing slash. */
  readonly url: string | undefined;
  /** The path the app lives under, `""` at the root. */
  readonly base: string;
  /** Whether the build renders every concrete route ahead of time. */
  readonly prerender: boolean;
  /** The renderer the config names, when it names one; `undefined` asks for the build's default. */
  readonly prerenderRenderer: PrerenderRenderer | undefined;
  /** Whether the web host runs the model layer in a worker. */
  readonly worker: boolean;
  /** Whether the web host runs each route change inside a view transition. */
  readonly transitions: boolean;
  /** Whether the web host moves focus to the new view after a route change. */
  readonly focusOnNavigate: boolean;
  /** The stores the config declares, `main` among them (of the host's default adapter unless it says). */
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
    this.title = config.title;
    this.theme = config.theme;
    this.scheme = config.scheme ?? "system";
    this.locale = config.locale ?? "en";
    this.icons = config.icons ?? "lucide";
    this.url = config.url === undefined ? undefined : config.url.replace(/\/+$/, "");
    this.base = appBase(config);
    this.prerender = config.prerender === true || typeof config.prerender === "string";
    this.prerenderRenderer = config.prerender === "markup" || config.prerender === "browser" ? config.prerender : undefined;
    this.worker = config.worker === true;
    this.transitions = config.transitions === true;
    this.focusOnNavigate = config.focusOnNavigate !== false;
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

export { pageHead } from "./head.ts";
export type { PageHead } from "./head.ts";
export { appBase, appUrl } from "./base.ts";
export type { BaseConfig } from "./base.ts";
