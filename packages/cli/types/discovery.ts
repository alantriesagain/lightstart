/**
 * @file What discovery hands the registry: commands already loaded by the node layer, routes as
 * their default-exported functions, and hooks by name. The core never imports a file itself.
 */
import type { ArgsSchema, Command } from "./command.ts";

export type Source = { name: string; root: string };

export type LoadedCommand = { command: Command<ArgsSchema>; source: Source };
export type LoadedHook = { fn: unknown; source: Source };
export type LoadedRoute = { app: unknown; source: Source };

export type Discovered = {
  commands: Map<string, LoadedCommand>;
  routes: LoadedRoute[];
  hooks: Map<string, LoadedHook[]>;
  cliDir: string;
};

/** What a discoverer is told: the project, the scopes and extra package names to scan, and a logger. */
export type DiscoverOptions = {
  projectDir: string;
  scopes: readonly string[];
  packages: readonly string[];
  log: import("./context.ts").Logger;
};

export type Discoverer = (options: DiscoverOptions) => Promise<Discovered> | Discovered;
