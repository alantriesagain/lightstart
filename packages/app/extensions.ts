/**
 * @file Extensions: a unit that plugs into an app. A package declares one in
 * its `package.json` (`"light": { "extension": "./extension.js" }`) and an app
 * keeps its own in `src/extensions/<name>.js`; each default-exports
 * `defineExtension({ name, fills, controllers, routes, connected, disconnected })`
 * and the generation lists them in the manifest. The run fills their slots
 * before the app's controllers start, starts their controllers after the
 * app's, then calls `connected`; `stop` reverses it. `defineApp({ extensions:
 * { off } })` leaves named extensions out.
 */

import type { RoutesMap } from "@lightstart/router";
import type { SlotEntry } from "./slots.ts";

/** What an extension declares. */
export interface ExtensionDefinition {
  /** Its name, unique in an app; what `extensions.off` names. */
  name: string;
  /** The slot items it fills, each from `slot.entry(item)`. */
  fills?: readonly SlotEntry[];
  /** Its controllers, started after the app's and stopped before them. */
  controllers?: readonly unknown[];
  /** Routes it adds to the app's table; a path the app or another extension declares is an error. */
  routes?: RoutesMap;
  /** Runs once its controllers are ready. */
  connected?: () => void | Promise<void>;
  /** Runs when the app stops, before its controllers stop. */
  disconnected?: () => void | Promise<void>;
}

/** An extension as the manifest carries it. */
export class AppExtension {
  readonly name: string;
  readonly fills: readonly SlotEntry[];
  readonly controllers: readonly unknown[];
  readonly routes: RoutesMap | null;
  readonly connected: (() => void | Promise<void>) | null;
  readonly disconnected: (() => void | Promise<void>) | null;

  constructor(definition: ExtensionDefinition) {
    this.name = definition.name;
    this.fills = definition.fills ?? [];
    this.controllers = definition.controllers ?? [];
    this.routes = definition.routes ?? null;
    this.connected = definition.connected ?? null;
    this.disconnected = definition.disconnected ?? null;
  }
}

/** Define an extension; its name must not be empty. */
export const defineExtension = (definition: ExtensionDefinition): AppExtension => {
  if (typeof definition.name !== "string" || definition.name.trim() === "") throw new Error("An extension needs a name");
  return new AppExtension(definition);
};

/** The extensions that run: `extensions` without those `off` names, a name used twice being an error; answers the names `off` matched none of too. */
export const activeExtensions = (extensions: readonly AppExtension[], off: readonly string[]): { active: AppExtension[]; unknown: string[] } => {
  const seen = new Set<string>();
  for (const extension of extensions) {
    if (seen.has(extension.name)) throw new Error(`Two extensions are named "${extension.name}"; rename one`);
    seen.add(extension.name);
  }
  return {
    active: extensions.filter((extension) => !off.includes(extension.name)),
    unknown: off.filter((name) => !seen.has(name)),
  };
};

/** `routes` with each extension's routes added; a path declared twice is an error naming the extension. */
export const mergeRoutes = (routes: RoutesMap | null, extensions: readonly AppExtension[]): RoutesMap | null => {
  const withRoutes = extensions.filter((extension) => extension.routes !== null);
  if (withRoutes.length === 0) return routes;
  const merged: RoutesMap = { ...(routes ?? {}) };
  for (const extension of withRoutes) {
    const own = extension.routes ?? {};
    for (const path of Object.keys(own)) {
      if (path in merged) throw new Error(`The extension "${extension.name}" adds the route "${path}", which is already declared`);
      merged[path] = own[path];
    }
  }
  return merged;
};
