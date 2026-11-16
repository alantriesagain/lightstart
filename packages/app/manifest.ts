/**
 * @file The manifest `.light/app.ts` exports: the app config, every model and
 * controller with the name its file gives it, the routes when the project has
 * them, and the view modules the generation imported for their tags. It is a
 * plain typed record so scriptc can compile the same manifest for the web and
 * the terminal.
 */

import type { ArgsSchema } from "@lightstart/cli/types/command.ts";
import type { ModelApi, ModelSchema, Row } from "@lightstart/light/model/types.ts";
import type { RoutesMap } from "@lightstart/router";
import type { AppHost, StorageConfig } from "./index.ts";

/** One model: the file's name without its extension, and the api its module default-exports. */
export interface AppModel {
  name: string;
  model: ModelApi<Row, ModelSchema>;
}

/** One controller: the file's name without its extension, and the controller its module default-exports. */
export interface AppController {
  name: string;
  controller: unknown;
}

/** The app config as a host sees it: its argument values and the lifecycle calls the host installs. */
export interface ManifestApp {
  name: string;
  host: AppHost;
  theme?: string;
  storage?: StorageConfig;
  root?: string;
  args?: Record<string, unknown>;
  argsSchema?: ArgsSchema;
  restart?(args?: Record<string, unknown>): Promise<void>;
  quit?(code?: number): Promise<void>;
}

/** What a project's folders add up to; the generated `.light/app.ts` default-exports one. */
export interface AppManifest {
  app: ManifestApp;
  /** The root view's class, for a terminal host; the generation reads it from the root view file's default export. */
  rootView?: unknown;
  models: readonly AppModel[];
  controllers: readonly AppController[];
  routes: RoutesMap | null;
  views: readonly string[];
}
