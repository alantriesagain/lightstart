/**
 * @file The manifest `.light/app.ts` exports: the app config, every model and
 * controller with the name its file gives it, the routes when the project has
 * them, and the view modules the generation imported for their tags. It is a
 * plain typed record so scriptc can compile the same manifest for the web and
 * the terminal.
 */

import type { ModelApi, ModelSchema, Row } from "@lightstart/light/model/types.ts";
import type { RoutesMap } from "@lightstart/router";
import type { App } from "./index.ts";

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

/** Rows a project's `src/seed.ts` (or `.js`) and `src/seed.dev.ts` (or `.js`) add once into empty stores, by model name. */
export type AppSeeds = Readonly<Record<string, readonly Row[]>>;

/** What a project's folders add up to; the generated `.light/app.ts` default-exports one. */
export interface AppManifest {
  app: App;
  /** The root view's class, for a terminal host; the generation reads it from the root view file's default export. */
  rootView?: unknown;
  models: readonly AppModel[];
  /** The project's seeds, in the order they load: `src/seed` before `src/seed.dev`. */
  seeds?: readonly AppSeeds[];
  controllers: readonly AppController[];
  routes: RoutesMap | null;
  views: readonly string[];
}
