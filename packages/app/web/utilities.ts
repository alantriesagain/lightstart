/// <reference lib="dom" />
/**
 * @file The web host's utility classes, imported only when the app declares
 * `utilities: true`: an engine built from the theme the host applies, and the
 * browser runtime that compiles the classes the views write into one
 * `<style data-tw-runtime>` before the root view draws.
 */

import { buildTheme, createEngine } from "@lightstart/light/theme/classes";
import { createRuntime } from "@lightstart/light/theme/runtime";
import type { ThemeData } from "@lightstart/light/theme/tokens";
import type { WebUtilitiesFeature } from "./features.ts";

interface UtilityRuntime {
  start(): void;
  stop(): void;
}

/** The web host's utility classes: the engine and runtime started once per page. */
export class Utilities implements WebUtilitiesFeature {
  private runtime: UtilityRuntime | null = null;

  /** Start the utility-class engine over `theme`, once per page; a second start does nothing. */
  start(theme: ThemeData): void {
    if (this.runtime !== null) return;
    const engine = createEngine({ theme: buildTheme(theme as Record<string, Record<string, unknown>>) });
    const runtime = createRuntime(engine);
    runtime.start();
    this.runtime = runtime;
  }

  /** Stop watching the document for utility classes. */
  stop(): void {
    const runtime = this.runtime;
    this.runtime = null;
    runtime?.stop();
  }
}
