/**
 * @file `@lightstart/app/tui`: the terminal host. It parses the app's
 * arguments beside `--data <dir>` (the current folder by default) and
 * `--scheme dark|light` (dark by default), opens the manifest's JSONL store,
 * names and starts its controllers, makes the manifest's root view, and runs
 * it with the baked class table for the scheme. Keys go to the root view's
 * `onKey` when it has one. `prepare` does everything but the terminal and
 * `mount` puts the root view on it. Everything imported here compiles
 * statically with scriptc.
 */

import { ArgError } from "@lightstart/cli/argv.ts";
import { configureModel, modelBus } from "@lightstart/light/model";
import { createAdapter, hasAdapter, registerStorageAdapter } from "@lightstart/light/model/adapter";
import JsonlAdapter from "@lightstart/light/model/jsonl";
import { createStore, storeRequest } from "@lightstart/light/model/store";
import { Terminal, View, runApp } from "@lightstart/light/native/tui";
import { BakedClasses } from "@lightstart/light/theme/baked";
import type { BakedEntry } from "@lightstart/light/theme/baked";
import type { ModelSchema, StorageAdapter, Store } from "@lightstart/light/model/types.ts";
import type { Renderer } from "@lightstart/light/native/tui";
import type { AppArgs, DirResolver, StorageConfig } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { MemoryAdapter } from "../memory.ts";
import { parseAppArgs } from "../args.ts";
import { schemasOf } from "../storage.ts";
import { startControllers, stopControllers } from "../controllers.ts";
import { fileIO } from "./file.ts";
import { callMounted, handlerOf } from "./root.ts";

/** The baked class tables a terminal app carries, one per scheme. */
export interface TuiClasses {
  dark: BakedEntry[];
  light: BakedEntry[];
}

/** What `start` takes: the folder, the scheme, the baked tables, and the arguments to read. */
export interface TuiOptions {
  /** The folder holding the JSONL files; the current folder by default. */
  data?: string;
  /** The theme's side; `"dark"` by default. */
  scheme?: "dark" | "light";
  /** The tables the generation baked; without them the terminal has no classes. */
  classes?: TuiClasses | null;
  /** The arguments to read instead of `process.argv.slice(2)`. */
  argv?: readonly string[];
}

/** What `mount` takes: the terminal, the baked tables, and the scheme. */
export interface MountOptions {
  term: Terminal;
  classes?: TuiClasses | null;
  scheme?: "dark" | "light";
}

/** A running app: `stop()` stops the renderer, disposes its controllers and closes its store. */
export interface AppHandle {
  stop(): Promise<void>;
}

const isClass = (value: unknown): value is new () => View => typeof value === "function";

const rootOf = (manifest: AppManifest): View => {
  const value = manifest.rootView;
  if (!isClass(value)) throw new Error("The manifest has no root view: the generation records the default export of src/views/<root>.ts");
  return new value();
};

const resolveDir = (dir: DirResolver | undefined, args: AppArgs, fallback: string): string =>
  typeof dir === "function" ? dir(args) : dir ?? fallback;

const openDatabase = async (kind: "jsonl" | "memory", name: string, dir: string, models: Record<string, ModelSchema>): Promise<StorageAdapter> => {
  if (kind === "jsonl") {
    if (!hasAdapter("jsonl")) registerStorageAdapter("jsonl", JsonlAdapter);
    const db = createAdapter("jsonl", { name, dir, io: fileIO(dir) });
    await db.init();
    return db;
  }
  if (!hasAdapter("memory")) registerStorageAdapter("memory", MemoryAdapter);
  const db = createAdapter("memory", { name, models });
  await db.init();
  return db;
};

const openTerminalStore = async (manifest: AppManifest, data: string): Promise<Store> => {
  const args = manifest.app.args;
  const models = schemasOf(manifest);
  const storage: StorageConfig = manifest.app.storage ?? { kind: "jsonl" };
  if (storage.kind === "indexeddb") throw new Error("The terminal host cannot open an IndexedDB store; use jsonl or memory");

  const defaultKey = storage.kind === "memory" ? "memory" : "jsonl";
  const defaultDir = resolveDir(storage.dir, args, data);
  const databases: Record<string, StorageAdapter> = {};
  databases[defaultKey] = await openDatabase(defaultKey, manifest.app.name, defaultDir, models);
  for (const [database, config] of Object.entries(storage.databases ?? {})) {
    if (database === defaultKey) continue;
    const kind = storage.kind === "memory" ? "memory" : config.kind;
    databases[database] = await openDatabase(kind, database, resolveDir(config.dir, args, defaultDir), models);
  }

  const store = createStore({
    models,
    databases,
    defaultAdapter: defaultKey,
    emit: (event, data) => modelBus().emit(event, data),
  });
  configureModel({ request: storeRequest(store) });
  return store;
};

/**
 * A prepared app: the manifest's store and controllers, and once it is
 * mounted the terminal, its classes and the renderer. Its `restart` and `quit`
 * are the app's lifecycle while it runs.
 */
export class Prepared {
  readonly manifest: AppManifest;
  store: Store;
  controllers: readonly unknown[] = [];
  /** The folder of the default JSONL database. */
  data: string;
  scheme: "dark" | "light";
  term: Terminal | null = null;
  classes: TuiClasses | null = null;
  renderer: Renderer | null = null;

  constructor(manifest: AppManifest, store: Store, data: string, scheme: "dark" | "light") {
    this.manifest = manifest;
    this.store = store;
    this.data = data;
    this.scheme = scheme;
  }

  /** Put a new root view on `term` with the tables for `scheme`; answers the renderer. */
  mount(term: Terminal, classes: TuiClasses | null, scheme: "dark" | "light"): Renderer {
    this.term = term;
    this.classes = classes;
    this.scheme = scheme;
    return this.mountRoot(term);
  }

  private mountRoot(term: Terminal): Renderer {
    const root = rootOf(this.manifest);
    const handler = handlerOf(root);
    const classes = this.classes;
    const table = classes === null ? null : this.scheme === "light" ? classes.light : classes.dark;
    const renderer = runApp({
      app: root,
      term,
      classes: table === null ? null : new BakedClasses(table),
      onKey: handler === null ? null : (render, e) => handler.call(root, render, e),
    });
    this.renderer = renderer;
    callMounted(root, renderer);
    return renderer;
  }

  /** Stop the renderer, dispose the controllers in reverse order and close the store. */
  async stop(): Promise<void> {
    const renderer = this.renderer;
    if (renderer !== null) {
      renderer.stop();
      this.renderer = null;
    }
    await stopControllers(this.controllers);
    await this.store.close();
  }

  /** Stop, merge `next` over the app's arguments, then open the store, start the controllers and mount a new root view again. */
  async restart(next?: Record<string, unknown>): Promise<void> {
    await this.stop();
    const args = this.manifest.app.args;
    args.values = { ...args.values, ...(next ?? {}) };
    this.data = args.string("data") ?? this.data;
    this.store = await openTerminalStore(this.manifest, this.data);
    this.controllers = await startControllers(this.manifest);
    const term = this.term;
    if (term !== null) this.mountRoot(term);
  }

  /** Stop, then exit with `code`. */
  async quit(code?: number): Promise<void> {
    await this.stop();
    process.exit(code ?? 0);
  }
}

/** Parse the arguments, open the store and start the controllers; no terminal is touched. */
export const prepare = async (manifest: AppManifest, options: TuiOptions = {}): Promise<Prepared> => {
  const argv = options.argv ?? process.argv.slice(2);
  let parsed: Record<string, unknown>;
  try {
    parsed = parseAppArgs(manifest.app, argv);
  } catch (error) {
    if (error instanceof ArgError) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }

  const data = options.data ?? String(parsed["data"] ?? ".");
  const scheme = options.scheme ?? String(parsed["scheme"] ?? "dark");
  if (scheme !== "dark" && scheme !== "light") {
    console.error("--scheme takes dark or light");
    process.exit(2);
  }
  parsed["data"] = data;
  parsed["scheme"] = scheme;
  manifest.app.args.values = parsed;

  const prepared = new Prepared(manifest, await openTerminalStore(manifest, data), data, scheme);
  prepared.controllers = await startControllers(manifest);
  manifest.app.lifecycle = {
    restart: (next?: Record<string, unknown>): Promise<void> => prepared.restart(next),
    quit: (code?: number): Promise<void> => prepared.quit(code),
  };
  return prepared;
};

/** Put the prepared app's root view on the terminal; answers the renderer. */
export const mount = (_manifest: AppManifest, prepared: Prepared, options: MountOptions): Renderer =>
  prepared.mount(options.term, options.classes ?? null, options.scheme ?? prepared.scheme);

/** Start the app on the terminal; answers the handle that stops it. */
export const start = async (manifest: AppManifest, options: TuiOptions = {}): Promise<AppHandle> => {
  const term = new Terminal();
  if (!term.isTTY) {
    console.error("needs an interactive terminal");
    process.exit(2);
  }

  const prepared = await prepare(manifest, options);
  mount(manifest, prepared, { term, classes: options.classes ?? null, scheme: options.scheme });
  return {
    async stop(): Promise<void> {
      await prepared.stop();
    },
  };
};
