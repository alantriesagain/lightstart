/// <reference lib="dom" />
/**
 * @file The web page's own stores: every store the app declares opened on the
 * page over one engine store, as a web app does without `worker: true`. The
 * generated entry passes it to `start`; a worker app passes `WorkerStores`
 * instead, so its page bundles none of the engine.
 */

import { openStores } from "../engine.ts";
import type { AppManifest } from "../manifest.ts";
import type { RunStore } from "../run.ts";
import type { StoreHost } from "../stores.ts";
import type { WebStoresFeature } from "./features.ts";

/** The stores feature the entry passes when the app does not run its model layer in a worker. */
export class LocalStores implements WebStoresFeature {
  /** Open every store on the page, all in memory when `memoryOnly` (a test's run). */
  open(manifest: AppManifest, host: StoreHost, memoryOnly: boolean): Promise<RunStore> {
    return openStores(manifest, host, memoryOnly);
  }
}
