/**
 * @file `@lightstart/app/tui`: the terminal host. Its store kinds are `jsonl`
 * (the default: files in the store's folder, `at`, else `--data`, `.data` in
 * the current folder by default) and `memory`, and a project's own. The arguments come
 * from argv: the app's, and the host's own `--data`, `--scheme dark|light`
 * (dark by default) and `--route` (the path the routes start at, `/` by
 * default), each unless the app declares that name itself; an argument error
 * prints its message and exits 2. The routes follow a history in memory, and
 * `<app-outlet>` is a terminal view drawing the view they answer. The root
 * view (the manifest's `rootView`) runs on the terminal with the baked class
 * table for the scheme; keys go to its `onKey`, and its `mounted(renderer)`
 * is told once it runs. It needs a TTY (exit 2 without one); everything
 * imported here compiles statically with scriptc.
 */

import { ArgError, parseArgs } from "@lightstart/cli/argv.ts";
import type { ArgsSchema } from "@lightstart/cli/types/command.ts";
import { createAdapter, hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import JsonlAdapter from "@lightstart/light/model/jsonl";
import { Terminal, View, runApp } from "@lightstart/light/native/tui";
import type { Renderer } from "@lightstart/light/native/tui";
import { BakedClasses } from "@lightstart/light/theme/baked";
import type { BakedEntry } from "@lightstart/light/theme/baked";
import type { ModelSchema, StorageAdapter } from "@lightstart/light/model/types.ts";
import { createMemoryAdapter } from "@lightstart/router/adapters/memory";
import type { RouterAdapter } from "@lightstart/router/contracts.ts";
import type { App } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { AppHost, AppRun } from "../run.ts";
import "./outlet.ts";
import { MemoryKind, StoreKind } from "../stores.ts";
import { fileIO } from "./file.ts";
import { callMounted, handlerOf } from "./root.ts";

export { currentParams, currentView, navigate } from "../run.ts";

/** The baked class tables a terminal app carries, one per scheme. */
export interface TuiClasses {
  dark: BakedEntry[];
  light: BakedEntry[];
}

/** What `start` takes: the baked tables, the arguments to read instead of `process.argv.slice(2)`, and the terminal. */
export interface TuiOptions {
  classes?: TuiClasses | null;
  argv?: readonly string[];
  /** The terminal to run on; a new one by default. */
  term?: Terminal | null;
}

/** A running app: `stop()` stops the renderer, disposes its controllers and closes its stores. */
export interface AppHandle {
  stop(): Promise<void>;
}

/** The arguments the terminal host takes beside the app's. */
export const hostArgs: ArgsSchema = {
  data: { default: ".data", description: "The folder that holds the JSONL files" },
  scheme: { choices: ["dark", "light"], default: "dark", description: "The theme's side" },
  route: { default: "/", description: "The path the routes start at" },
};

const openJsonl = async (store: string, dir: string): Promise<StorageAdapter> => {
  if (!hasAdapter("jsonl")) registerStorageAdapter("jsonl", JsonlAdapter);
  const db = createAdapter("jsonl", { name: store, dir, io: fileIO(dir) });
  await db.init();
  return db;
};

/** JSON Lines files: a file per model in the store's folder (`at`, else `--data`). */
export class JsonlKind extends StoreKind {
  readonly name = "jsonl";

  open(app: App, store: string, at: string, _models: Record<string, ModelSchema>, _main: boolean): Promise<StorageAdapter> {
    return openJsonl(store, at.length > 0 ? at : app.args.string("data") ?? ".data");
  }
}

const isClass = (value: unknown): value is new () => View => typeof value === "function";

/** The terminal host. */
export class TuiHost extends AppHost {
  readonly name = "tui";
  readonly kinds: readonly StoreKind[] = [new JsonlKind(), new MemoryKind()];
  readonly defaultKind = "jsonl";
  readonly argv: readonly string[];
  readonly classes: TuiClasses | null;
  term: Terminal | null;
  renderer: Renderer | null = null;

  constructor(options: TuiOptions = {}) {
    super();
    this.argv = options.argv ?? process.argv.slice(2);
    this.classes = options.classes ?? null;
    this.term = options.term ?? null;
  }

  args(app: App): Record<string, unknown> {
    try {
      return parseArgs({ ...hostArgs, ...app.argsSchema }, this.argv) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof ArgError) {
        console.error(error.message);
        process.exit(2);
      }
      throw error;
    }
  }

  history(): RouterAdapter {
    return createMemoryAdapter("/");
  }

  mount(run: AppRun): Promise<void> {
    this.put(run);
    return Promise.resolve();
  }

  private put(run: AppRun): void {
    const router = run.router;
    const route = run.app.args.string("route") ?? "/";
    if (router !== null && route !== "/") router.go(route);
    let term = this.term;
    if (term === null) {
      term = new Terminal();
      if (!term.isTTY) {
        console.error("needs an interactive terminal");
        process.exit(2);
      }
      this.term = term;
    }
    const made = run.manifest.rootView;
    if (!isClass(made)) throw new Error("The manifest has no root view: the generation records the default export of src/views/<root>.ts");
    const root = new made();
    const handler = handlerOf(root);
    const classes = this.classes;
    const table = classes === null ? null : run.app.args.string("scheme") === "light" ? classes.light : classes.dark;
    const renderer = runApp({
      app: root,
      term,
      classes: table === null ? null : new BakedClasses(table),
      onKey: handler === null ? null : (render, e) => handler.call(root, render, e),
    });
    this.renderer = renderer;
    callMounted(root, renderer);
  }

  unmount(_run: AppRun): void {
    const renderer = this.renderer;
    this.renderer = null;
    if (renderer !== null) renderer.stop();
  }

  exit(code: number): void {
    process.exit(code);
  }
}

/** Start the app on the terminal; answers the handle that stops it. */
export const start = async (manifest: AppManifest, options: TuiOptions = {}): Promise<AppHandle> => {
  const run = new AppRun(manifest, new TuiHost(options));
  await run.start();
  return { stop: () => run.stop() };
};
