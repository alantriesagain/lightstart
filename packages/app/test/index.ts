/**
 * @file `@lightstart/app/test`: open an app's store and controllers without a
 * page. `openApp` answers the manifest's store and controllers so a test can
 * write through a controller and read the rows back; `stop()` disposes them.
 */

import type { Store } from "@lightstart/light/model/types.ts";
import type { StorageConfig, StorageKind } from "../index.ts";
import { openStore } from "../storage.ts";
import { startControllers, stopControllers } from "../controllers.ts";
import type { AppManifest } from "../manifest.ts";

/** What a test asks `openApp` for: the storage kind, memory when absent. */
export interface OpenAppOptions {
  storage?: StorageKind | StorageConfig;
}

/** An app opened for a test. */
export interface OpenedApp {
  store: Store;
  controllers: readonly unknown[];
  stop(): Promise<void>;
}

/** Open the manifest's store and controllers, mounting nothing. */
export const openApp = async (manifest: AppManifest, options: OpenAppOptions = {}): Promise<OpenedApp> => {
  const store = await openStore(manifest, options.storage ?? "memory");
  const controllers = await startControllers(manifest);
  return {
    store,
    controllers,
    async stop(): Promise<void> {
      await stopControllers(controllers);
      await store.close();
    },
  };
};
