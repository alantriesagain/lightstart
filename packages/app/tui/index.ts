/**
 * @file `@lightstart/app/tui`: the terminal host. It parses `--data <dir>`
 * (the current folder by default) and `--scheme dark|light` (dark by
 * default), opens the manifest's store over JSONL files in that folder,
 * names and starts its controllers, makes the manifest's root view, and
 * runs it with the baked class table for the scheme. Keys go to the root
 * view's `onKey` when it has one. It needs a TTY; everything it imports
 * compiles statically with scriptc.
 */

import { Terminal, View, runApp } from "@lightstart/light/native/tui";
import { BakedClasses } from "@lightstart/light/theme/baked";
import { openJsonl } from "@lightstart/light/model/jsonl";
import type { BakedEntry } from "@lightstart/light/theme/baked";
import type { KeyEvent, Renderer } from "@lightstart/light/native/tui";
import type { AppManifest } from "../manifest.ts";
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
  /** The arguments to read instead of `process.argv`. */
  argv?: readonly string[];
}

/** A running app: `stop()` stops the renderer, disposes its controllers and closes its store. */
export interface AppHandle {
  stop(): Promise<void>;
}

const argument = (argv: readonly string[], name: string, fallback: string): string => {
  const at = argv.indexOf(name);
  return at >= 0 && at + 1 < argv.length ? (argv[at + 1] ?? fallback) : fallback;
};

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

/** Start the app on the terminal; answers the handle that stops it. */
export const start = async (manifest: AppManifest, options: TuiOptions = {}): Promise<AppHandle> => {
  const argv = options.argv ?? process.argv;
  const data = options.data ?? argument(argv, "--data", ".");
  const scheme = options.scheme ?? argument(argv, "--scheme", "dark");
  if (scheme !== "dark" && scheme !== "light") {
    console.error("--scheme takes dark or light");
    process.exit(2);
  }

  const term = new Terminal();
  if (!term.isTTY) {
    console.error("needs an interactive terminal");
    process.exit(2);
  }

  const store = await openJsonl({ name: manifest.app.name, dir: data, io: fileIO(data), models: manifest.models.map((entry) => entry.model) });
  const controllers = await startControllers(manifest);
  const root = rootOf(manifest);
  const handler = handlerOf(root);
  const table = options.classes === undefined || options.classes === null ? null : scheme === "light" ? options.classes.light : options.classes.dark;
  const renderer = runApp({
    app: root,
    term,
    classes: table === null ? null : new BakedClasses(table),
    onKey: handler === null ? null : (render, e) => handler.call(root, render, e),
  });

  return {
    async stop(): Promise<void> {
      renderer.stop();
      await stopControllers(controllers);
      await store.close();
    },
  };
};
