/**
 * @file `@lightstart/app`: the few choices a project makes about its app.
 * `defineApp` is an identity wrapper over the config the generated manifest
 * carries; the host reads the rest of the wiring from the project's folders.
 */

/** The host an app runs on. */
export type AppHost = "web" | "tui";

/** Where an app keeps its rows. */
export type StorageKind = "indexeddb" | "jsonl" | "memory";

/** The store an app opens. `name` defaults to the app's name; a JSONL store also takes a folder. */
export interface StorageConfig {
  kind: StorageKind;
  name?: string;
}

/** What `src/app.ts` declares: the few choices a project makes. */
export interface AppConfig {
  /** The app's name, used as the store's database name and the document title. */
  name: string;
  /** The host the generated entry starts. */
  host: AppHost;
  /** A theme preset name; `"default"` when absent. */
  theme?: string;
  /** The store to open; IndexedDB on the web and JSONL files on the terminal when absent. */
  storage?: StorageConfig;
  /** The root view's tag; `"app-root"` when absent. */
  root?: string;
}

/** The app's config, typed and unchanged. */
export const defineApp = <C extends AppConfig>(config: C): C => config;
