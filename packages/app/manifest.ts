/**
 * @file The manifest `.light/app.ts` exports: the app config, every model and
 * controller with the name its file gives it, the routes when the project has
 * them, and the view modules the generation imported for their tags. It is a
 * plain typed record so scriptc can compile the same manifest for the web and
 * the terminal.
 */

import type { ModelApi } from "@lightstart/light/model/types.ts";
import type { RoutesMap } from "@lightstart/router";
import type { AppConfig } from "./index.ts";

/** One model: the file's name without its extension, and the api its module default-exports. */
export interface AppModel {
  name: string;
  model: ModelApi;
}

/** One controller: the file's name without its extension, and the controller its module default-exports. */
export interface AppController {
  name: string;
  controller: unknown;
}

/** What a project's folders add up to; the generated `.light/app.ts` default-exports one. */
export interface AppManifest {
  app: AppConfig;
  models: readonly AppModel[];
  controllers: readonly AppController[];
  routes: RoutesMap | null;
  views: readonly string[];
}
