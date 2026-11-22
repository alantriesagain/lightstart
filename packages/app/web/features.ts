/// <reference lib="dom" />
/**
 * @file The web host's seam to its optional features. The host itself imports
 * no optional feature: the generated entry imports the ones the app's config
 * uses (`web/indexeddb.ts` for the IndexedDB adapter type, `web/local.ts` for
 * stores on the page, `web/worker.ts` for stores in a worker,
 * `web/transitions.ts` for view transitions, `web/utilities.ts` for the
 * theme's utility classes and `web/args.ts` for the URL's arguments) and hands
 * them to `start` as these shapes.
 */

import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import type { RunStore, RouteTransition } from "../run.ts";
import type { StoreHost } from "../stores.ts";
import type { ThemeData } from "@lightstart/light/theme/tokens";

/** What the entry hands `start`: where the run's stores open, on the page (`web/local.ts`) or in a worker (`web/worker.ts`). */
export interface WebStoresFeature {
  /** Open every store the app declares, and hand the run what it needs of it. */
  open(manifest: AppManifest, host: StoreHost, memoryOnly: boolean): Promise<RunStore>;
}

/** What a transition feature reads of the host while it wraps a route change. */
export interface WebTransitionPort {
  /** The route container in the mounted root, when the page has one. */
  container(): Element | null;
  /** The mounted root element. */
  root(): Element | null;
  /** The `href` of the page on screen. */
  href(): string | null;
  /** Whether the route change came from the browser's history. */
  historyNavigation(): boolean;
}

/** What the entry hands `start` when the app declares `transitions: true`. */
export interface WebTransitionFeature {
  /** Install light's default `morph` rules once. */
  installStyles(): void;
  /** Run `apply` inside `document.startViewTransition` where the browser has it, morphing the source into the next view. */
  transition(apply: () => Promise<void> | void, route: RouteTransition | undefined, port: WebTransitionPort): Promise<void>;
  /** Remember the anchor a document click goes through, before the router's own listener sees it. */
  recordClick(event: Event): void;
  /** Drop the remembered click, so a later route change does not morph from it. */
  clearClick(): void;
  /** Clear the name and the remembered click when the run unmounts. */
  reset(): void;
}

/** What the entry hands `start` when the app declares arguments. */
export type WebArgsFeature = (app: App) => Record<string, unknown>;

/** What the entry hands `start` when the app declares `utilities: true`. */
export interface WebUtilitiesFeature {
  /** Start the utility-class engine over `theme`; a second start does nothing. */
  start(theme: ThemeData): void;
  /** Stop watching the document for utility classes. */
  stop(): void;
}
