/**
 * @file `@lightstart/app/test`: open an app's store and controllers without a
 * page, and mount its root view on light's test terminal. `openApp` answers
 * the manifest's store and controllers so a test can write through a
 * controller and read the rows back; `mountApp` runs the root view over it.
 */

import { frames, runApp } from "@lightstart/light/native/tui";
import { TestTerminal } from "@lightstart/light/native/tui/test-terminal.ts";
import type { View } from "@lightstart/light/native/tui";
import type { ClassStyler } from "@lightstart/light/native/tui/classes.ts";
import type { Renderer } from "@lightstart/light/native/tui";
import type { Store } from "@lightstart/light/model/types.ts";
import type { StorageConfig, StorageKind } from "../index.ts";
import { openStore } from "../storage.ts";
import { startControllers, stopControllers } from "../controllers.ts";
import { parseAppArgs } from "../args.ts";
import type { AppManifest } from "../manifest.ts";
import { callMounted, handlerOf } from "../tui/root.ts";

/** What a test asks `openApp` for: the storage kind, memory when absent, and the arguments. */
export interface OpenAppOptions {
  storage?: StorageKind | StorageConfig;
  args?: readonly string[] | Record<string, unknown>;
}

/** An app opened for a test. */
export interface OpenedApp {
  store: Store;
  controllers: readonly unknown[];
  restart(args?: Record<string, unknown>): Promise<void>;
  quit(code?: number): Promise<void>;
  stop(): Promise<void>;
}

/** What `mountApp` takes: the test terminal's size, and the classes styler (the baked table, or a theme's classes in a node-only test); none by default. */
export interface MountAppOptions {
  cols?: number;
  rows?: number;
  classes?: ClassStyler | null;
}

/** A root view mounted on a test terminal, with helpers to settle frames and read the screen. */
export interface MountedApp {
  term: TestTerminal;
  renderer: Renderer;
  /** The root view the manifest names, as it was made. */
  root: View;
  settle(): Promise<void>;
  text(): string;
  stop(): void;
}

const argsOf = (manifest: AppManifest, given: OpenAppOptions["args"]): Record<string, unknown> => {
  if (Array.isArray(given)) return parseAppArgs(manifest.app, given);
  return { ...parseAppArgs(manifest.app, []), ...(given ?? {}) };
};

const isClass = (value: unknown): value is new () => View => typeof value === "function";

/** Open the manifest's store and controllers, mounting nothing. */
export const openApp = async (manifest: AppManifest, options: OpenAppOptions = {}): Promise<OpenedApp> => {
  manifest.app.args = argsOf(manifest, options.args);
  const opened: OpenedApp = {
    store: await openStore(manifest, options.storage ?? "memory"),
    controllers: [],
    async restart(next?: Record<string, unknown>): Promise<void> {
      await stopControllers(opened.controllers);
      await opened.store.close();
      const args = { ...(manifest.app.args ?? {}), ...(next ?? {}) };
      manifest.app.args = args;
      opened.store = await openStore(manifest, options.storage ?? "memory");
      opened.controllers = await startControllers(manifest);
    },
    async quit(code?: number): Promise<void> {
      await stopControllers(opened.controllers);
      await opened.store.close();
      process.exit(code ?? 0);
    },
    async stop(): Promise<void> {
      await stopControllers(opened.controllers);
      await opened.store.close();
    },
  };
  opened.controllers = await startControllers(manifest);
  manifest.app.restart = opened.restart;
  manifest.app.quit = opened.quit;
  return opened;
};

/** Run the manifest's root view on a test terminal over an opened app. */
export const mountApp = (manifest: AppManifest, _opened: OpenedApp, options: MountAppOptions = {}): MountedApp => {
  const value = manifest.rootView;
  if (!isClass(value)) throw new Error("The manifest has no root view: the generation records the default export of src/views/<root>.ts");
  const root = new value();
  const handler = handlerOf(root);
  const term = new TestTerminal();
  term.cols = options.cols ?? 50;
  term.rows = options.rows ?? 10;
  const renderer = runApp({
    app: root,
    term,
    classes: options.classes ?? null,
    onKey: handler === null ? null : (render, e) => handler.call(root, render, e),
  });
  callMounted(root, renderer);

  return {
    term,
    renderer,
    root,
    async settle(): Promise<void> {
      for (let i = 0; i < 6; i++) await new Promise((settle) => setTimeout(settle, 0));
      frames.flush();
      renderer.renderFrame();
    },
    text(): string {
      const { w, h, glyph } = renderer.back;
      const lines: string[] = [];
      for (let y = 0; y < h; y++) {
        let line = "";
        for (let x = 0; x < w; x++) line += glyph[y * w + x] === 0 ? " " : String.fromCodePoint(glyph[y * w + x] ?? 0);
        lines.push(line.trimEnd());
      }
      return lines.join("\n");
    },
    stop(): void {
      renderer.stop();
    },
  };
};
