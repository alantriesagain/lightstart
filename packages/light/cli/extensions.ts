/**
 * @file The api each of light's own commands hands an extension, and the
 * declaration merges that type `defineExtension(command, …)`'s `api` in a
 * project's `cli/extend/<command>.ts`.
 */
import type { ProjectContext, RuleSource } from "../check/types.ts";
import type { runFiles } from "../test/run.js";
import type { serve } from "../test/serve.js";

/** What a context wrapper receives about the pass it wraps. */
export interface CheckInfo {
  dir: string;
  root: string;
  rule?: string;
  json: boolean;
}

/** A replacement check run: the targets, the filter, json, and light's own pass over one folder. */
export interface CheckInput {
  targets: string[];
  root: string | null;
  rule: string | undefined;
  json: boolean;
  runOnce(dir: string): Promise<boolean>;
}

/** What `light check` hands a `cli/extend/check.ts`. */
export interface CheckExtension {
  /** Add a function that sees the sources gathered so far and answers the list to add. */
  sources(add: (sources: RuleSource[]) => RuleSource[]): void;
  /** Add rule sources beside the project's own. */
  addSources(...sources: RuleSource[]): void;
  /** Wrap or replace the context a rule reads, once per `runOnce`. */
  context(wrap: (context: ProjectContext, info: CheckInfo) => ProjectContext): void;
  /** Replace the whole run; `input.runOnce(dir)` still runs light's own engine over a folder. */
  run(fn: (input: CheckInput) => Promise<boolean> | boolean): void;
}

/** The options the runner page light serves receives. */
export interface RunnerPageOptions {
  file: string;
  importmap: Record<string, string>;
  harnessUrl: string;
  reportUrl: string;
  prelude?: string;
}

/** What one browser test group receives. */
export interface TestInput {
  args: Record<string, unknown>;
  projectDir: string;
  root: string;
  headless: boolean;
  timeoutMs: number;
  runFiles: typeof runFiles;
  serve: typeof serve;
}

/** One test group a `cli/extend/test.ts` adds. */
export interface TestGroup {
  name: string;
  flag?: string;
  description: string;
  run(input: TestInput): Promise<boolean> | boolean;
}

/** What `light test` hands a `cli/extend/test.ts`. */
export interface TestExtension {
  /** Add a group; `flag` names an argument the extension declared to select it. */
  group(group: TestGroup): void;
  /** Replace the runner page light's own browser run serves. */
  runnerPage(render: (options: RunnerPageOptions) => string): void;
}

/** What a desktop host resolver, and the argument builders, receive. */
export interface DesktopInput {
  args: Record<string, unknown>;
  projectDir: string;
  origin: string;
  port: number;
  attach: boolean;
}

/** What `light desktop dev` hands a `cli/extend/desktop.ts`. */
export interface DesktopExtension {
  /** Name the executable that opens the window; the default is light's own shell. */
  host(resolve: (input: DesktopInput) => Promise<string> | string): void;
  /** Add arguments to the host executable; return the list, or push into it. */
  hostArgs(add: (args: string[], input: DesktopInput) => string[] | void): void;
  /** Add arguments to the spawned `light serve`; return the list, or push into it. */
  serveArgs(add: (args: string[], input: DesktopInput) => string[] | void): void;
}

declare module "@lightstart/cli" {
  interface Extensions {
    check: CheckExtension;
    test: TestExtension;
    desktop: DesktopExtension;
  }
}
