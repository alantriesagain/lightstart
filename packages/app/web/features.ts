/// <reference lib="dom" />
/**
 * @file The web host's seam to its optional features. The host itself imports
 * no optional feature: the generated entry imports the ones the app's config
 * uses (`web/indexeddb.ts` for the IndexedDB adapter type, `web/worker.ts` for worker
 * stores, `web/transitions.ts` for view transitions and `web/args.ts` for the
 * URL's arguments) and hands them to `start` as these shapes.
 */

import type { App } from "../index.ts";
import type { RouteTransition } from "../run.ts";
import type { PlannedStore } from "../stores.ts";
import type { StorageAdapter } from "@lightstart/light/model/types.ts";

/** One worker a page opened, as the host and the worker feature see it. */
export interface WebWorkerConnection {
  retain(): void;
  release(): void;
  failedMessage(): string;
  request(name: string, payload: unknown): Promise<unknown>;
  post(name: string, payload: unknown): void;
}

/** What the entry hands `start` when a store declares `worker: true`. */
export interface WebWorkerFeature {
  /** Spawn one worker and open the channel to it; `onEmpty` runs when the last store releases it. */
  connect(onEmpty: () => void): Promise<WebWorkerConnection>;
  /** Open `store` through `connection`, answering the page's adapter. */
  open(connection: WebWorkerConnection, store: PlannedStore, memoryOnly: boolean): Promise<StorageAdapter>;
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
