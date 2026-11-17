/**
 * @file `@lightstart/app/test`: an app's run without a host's surface, for a
 * test. `openApp` fills the arguments (an argv list, or a record over the
 * defaults), opens every store in memory, starts the controllers and the
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
import { MemoryKind, StoreKind } from "../stores.ts";

/** What a test opens the app with: its arguments, an argv list or a record over the defaults. */
export interface OpenAppOptions {
  args?: readonly string[] | Record<string, unknown>;
}

/** An app opened for a test: its run, the run's stores and controllers, and its restart, quit and stop. */
export class OpenedApp {
  readonly run: AppRun;

  constructor(run: AppRun) {
    this.run = run;
  }

  /** The run's stores (an error once it stopped). */
  get store(): Store {
    const store = this.run.store;
    if (store === null) throw new Error("the app is stopped");
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

/** A test's host: memory stores, the arguments it was given, nothing to mount. */
class TestHost extends AppHost {
  readonly name = "test";
  readonly kinds: readonly StoreKind[] = [new MemoryKind()];
  readonly defaultKind = "memory";
  private readonly given: readonly string[] | Record<string, unknown> | undefined;

  constructor(given: readonly string[] | Record<string, unknown> | undefined) {
    super();
    this.given = given;
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
  const run = new AppRun(manifest, new TestHost(options.args), true);
  await run.start();
  return new OpenedApp(run);
};
