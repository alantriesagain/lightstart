/**
 * @file `@lightstart/app/tui/test`: a terminal app's root view mounted on
 * light's test terminal over a run `openApp` opened, with helpers to settle
 * the frames and read the screen. Keys go to the root view's `onKey`, and its
 * `mounted(renderer)` is told, as on the terminal.
 */

import { frames, runApp } from "@lightstart/light/native/tui";
import { TestTerminal } from "@lightstart/light/native/tui/test-terminal.ts";
import type { Renderer, View } from "@lightstart/light/native/tui";
import type { ClassStyler } from "@lightstart/light/native/tui/classes.ts";
import type { AppManifest } from "../manifest.ts";
import type { OpenedApp } from "../test/index.ts";
import { callMounted, handlerOf } from "./root.ts";
import "./container.ts";

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

const isClass = (value: unknown): value is new () => View => typeof value === "function";

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
