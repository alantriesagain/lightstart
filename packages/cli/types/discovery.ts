/**
 * @file What discovery hands the registry: files already listed but not imported, and the loader
 * that imports one when it is needed. The core never imports a file itself.
 */
import type { ArgsSchema, Command } from "./command.ts";
import type { ExtensionDefinition } from "./extension.ts";

export type Source = { name: string; root: string };

/** A module discovery listed; `load` imports it on demand. */
export type ListedModule = { file: string; source: Source };

export type CommandRecord = ListedModule;
export type HookRecord = ListedModule;
export type RouteRecord = ListedModule;
export type ExtensionRecord = ListedModule & { command: string };

export type LoadedCommand = { command: Command<ArgsSchema>; source: Source; name: string };
export type LoadedHook = { fn: unknown; source: Source };
export type LoadedRoute = { app: unknown; source: Source };
export type LoadedExtension = { extension: ExtensionDefinition; source: Source };

/**
 * Imports a listed file. The node layer supplies the one that uses `import()`; a CLI without
 * discovery never calls it.
 */
export class FileLoader {
  load(_file: string): Promise<unknown> {
    return Promise.reject(new Error("This CLI has no file loader"));
  }
}

export type Discovered = {
  commands: Map<string, CommandRecord>;
  routes: RouteRecord[];
  hooks: Map<string, HookRecord[]>;
  extensions: Map<string, ExtensionRecord[]>;
  cliDir: string;
  loader: FileLoader | null;
};

/** What a discoverer is told: the project, the scopes and extra package names to scan, the CLI's folder, and a logger. */
export type DiscoverOptions = {
  projectDir: string;
  scopes: readonly string[];
  packages: readonly string[];
  cliDir?: string;
  log: import("./context.ts").Logger;
};

export type Discoverer = (options: DiscoverOptions) => Promise<Discovered> | Discovered;
