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
import type { KeyEvent, Renderer } from "@lightstart/light/native/tui";
import type { DirResolver, StorageConfig } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { MemoryAdapter } from "../memory.ts";
import { parseAppArgs } from "../args.ts";
import { schemasOf } from "../storage.ts";
import { startControllers, stopControllers } from "../controllers.ts";
import { fileIO } from "./file.ts";

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

/** A prepared app: the store and controllers of a manifest, with no terminal yet. */
export interface Prepared {
  store: Store;
  controllers: readonly unknown[];
  args: Record<string, unknown>;
  data: string;
  scheme: "dark" | "light";
  stop(): Promise<void>;
}

/** A running app: `stop()` stops the renderer, disposes its controllers and closes its store. */
export interface AppHandle {
  stop(): Promise<void>;
}

interface Lifecycle {
  renderer: Renderer | null;
  term: Terminal | null;
  classes: TuiClasses | null;
  scheme: "dark" | "light";
}

interface Attachable {
  attach(term: Terminal, classes: TuiClasses | null, scheme: "dark" | "light"): Renderer;
}

const isClass = (value: unknown): value is new () => View => typeof value === "function";

const rootOf = (manifest: AppManifest): View => {
  const value = manifest.rootView;
  if (!isClass(value)) throw new Error("The manifest has no root view: the generation records the default export of src/views/<root>.ts");
  return new value();
};

const handlerOf = (value: unknown): ((renderer: Renderer, e: KeyEvent) => boolean) | null => {
  if (typeof value !== "object" || value === null) return null;
  const handler = (value as Record<string, unknown>)["onKey"];
  return typeof handler === "function" ? (handler as (renderer: Renderer, e: KeyEvent) => boolean) : null;
};

const resolveDir = (dir: DirResolver | undefined, args: Record<string, unknown>, fallback: string): string =>
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

const openTerminalStore = async (manifest: AppManifest, args: Record<string, unknown>, data: string): Promise<Store> => {
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
  manifest.app.args = parsed;

  const state: Lifecycle = { renderer: null, term: null, classes: null, scheme };
  const prepared: Prepared = {
    store: await openTerminalStore(manifest, parsed, data),
    controllers: [],
    args: parsed,
    data,
    scheme,
    async stop(): Promise<void> {
      if (state.renderer !== null) {
        state.renderer.stop();
        state.renderer = null;
      }
      await stopControllers(prepared.controllers);
      await prepared.store.close();
    },
  };
  prepared.controllers = await startControllers(manifest);

  const mountRoot = (): Renderer => {
    if (state.term === null) throw new Error("The app has no terminal to mount on");
    const root = rootOf(manifest);
    const handler = handlerOf(root);
    const table = state.classes === null ? null : state.scheme === "light" ? state.classes.light : state.classes.dark;
    const renderer = runApp({
      app: root,
      term: state.term,
      classes: table === null ? null : new BakedClasses(table),
      onKey: handler === null ? null : (render, e) => handler.call(root, render, e),
    });
    state.renderer = renderer;
    return renderer;
  };

  const attach = (term: Terminal, classes: TuiClasses | null, attached: "dark" | "light"): Renderer => {
    state.term = term;
    state.classes = classes;
    state.scheme = attached;
    return mountRoot();
  };

  manifest.app.restart = async (next?: Record<string, unknown>): Promise<void> => {
    if (state.renderer !== null) {
      state.renderer.stop();
      state.renderer = null;
    }
    await stopControllers(prepared.controllers);
    await prepared.store.close();
    const args = { ...(manifest.app.args ?? {}), ...(next ?? {}) };
    manifest.app.args = args;
    prepared.args = args;
    prepared.data = String(args["data"] ?? prepared.data);
    prepared.store = await openTerminalStore(manifest, args, prepared.data);
    prepared.controllers = await startControllers(manifest);
    if (state.term !== null) mountRoot();
  };

  manifest.app.quit = async (code?: number): Promise<void> => {
    if (state.renderer !== null) {
      state.renderer.stop();
      state.renderer = null;
    }
    await stopControllers(prepared.controllers);
    await prepared.store.close();
    process.exit(code ?? 0);
  };

  return { ...prepared, attach } as Prepared & Attachable;
};

/** Put the prepared app's root view on the terminal; answers the renderer. */
export const mount = (_manifest: AppManifest, prepared: Prepared, options: MountOptions): Renderer => {
  const attach = (prepared as Prepared & Partial<Attachable>).attach;
  if (attach === undefined) throw new Error("The app was not prepared by @lightstart/app/tui");
  return attach.call(prepared, options.term, options.classes ?? null, options.scheme ?? prepared.scheme);
};

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
