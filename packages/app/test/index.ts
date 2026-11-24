/**
 * @file `@lightstart/app/test`: an app's run without a host's surface, for a
 * test. `openApp` fills the arguments (an argv list, or a record over the
 * defaults), opens every store in memory (or with the adapter types the test names), starts the controllers and the
 * routes (over a history in memory) and mounts nothing; a test writes through
 * a controller and reads the rows back. The run's `restart` and `quit` are
 * the app's, as on a host. A host's own test mount is its: the terminal's
 * `mountApp` is `@lightstart/app/tui/test`'s.
 */

import { parseArgs } from "@lightstart/cli/argv.ts";
import type { Store } from "@lightstart/light/model/types.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppHost, AppRun } from "../run.ts";
import type { RunStore } from "../run.ts";
import { openStores as openLocalStores } from "../engine.ts";
import { MemoryAdapterType, AdapterType } from "../stores.ts";

/** What a test opens the app with: its arguments (an argv list or a record over the defaults), and the store adapter types it runs (every store in memory when absent). */
export interface OpenAppOptions {
  args?: readonly string[] | Record<string, unknown>;
  /** The adapter types the stores open with, the first the default, `memory` beside them; a test that checks what lands on disk passes a host's (`JsonlAdapterType`). */
  adapters?: readonly AdapterType[];
  /** Whether the manifest's seeds load; `true` when absent. */
  seed?: boolean;
  /** `false` runs no extension (a public suite); `{ off }` leaves the named ones out. */
  extensions?: false | { off: readonly string[] };
}

/** An app opened for a test: its run, the run's stores and controllers, and its restart, quit and stop. */
export class OpenedApp {
  readonly run: AppRun;
  private readonly host: TestHost;

  constructor(run: AppRun, host: TestHost) {
    this.run = run;
    this.host = host;
  }

  /** The run's engine store, opened in this process (an error once it stopped). */
  get store(): Store {
    const store = this.host.opened;
    if (store === null || this.run.store === null) throw new Error("the app is stopped");
    return store;
  }

  get controllers(): readonly unknown[] {
    return this.run.controllers;
  }

  restart(args?: Record<string, unknown>): Promise<void> {
    return this.run.restart(args);
  }

  quit(code?: number): Promise<void> {
    return this.run.quit(code);
  }

  stop(): Promise<void> {
    return this.run.stop();
  }
}

/** A test's host: the adapter types it was given (memory), the arguments it was given, nothing to mount. */
class TestHost extends AppHost {
  readonly name = "test";
  /** The engine store the run opened, for `OpenedApp.store`. */
  opened: Store | null = null;
  private readonly given: readonly string[] | Record<string, unknown> | undefined;

  constructor(given: readonly string[] | Record<string, unknown> | undefined, adapters: readonly AdapterType[]) {
    super();
    this.openStores = (manifest: AppManifest, memoryOnly: boolean): Promise<RunStore> =>
      openLocalStores(manifest, this, memoryOnly).then((store) => {
        this.opened = store;
        return store;
      });
    this.given = given;
    this.adapters = adapters.length > 0 ? adapters : [new MemoryAdapterType()];
    this.defaultAdapter = this.adapters[0]?.name ?? "memory";
  }

  args(app: App): Record<string, unknown> {
    const given = this.given;
    if (Array.isArray(given)) return parseArgs(app.argsSchema, given) as Record<string, unknown>;
    return { ...(parseArgs(app.argsSchema, []) as Record<string, unknown>), ...(given ?? {}) };
  }

  exit(code: number): void {
    process.exit(code);
  }
}

/** Open the manifest's run over memory stores, mounting nothing. */
export const openApp = async (manifest: AppManifest, options: OpenAppOptions = {}): Promise<OpenedApp> => {
  const adapters = options.adapters ?? [];
  const host = new TestHost(options.args, adapters);
  const run = new AppRun(manifest, host, adapters.length === 0, options.seed !== false, options.extensions === false ? false : options.extensions?.off ?? []);
  await run.start();
  return new OpenedApp(run, host);
};
