/**
 * @file What a build is: its options, the context the named steps share, and the report it answers.
 */
import type { ImportMap } from "./importmap.ts";
import type { ParsedPage } from "./html.ts";

/** One output file of a build, at a path relative to the build folder. */
export type BuildFile = { path: string; bytes: number };

/** What a finished build answers: its id, its folder, its files and how long it took. */
export type BuildReport = { id: string; dir: string; files: BuildFile[]; ms: number };

/** A message a step may log. */
export type BuildLog = (message: string) => void;

/** The context every step reads and writes: the page, the importmap, and the outputs waiting to be written. */
export type BuildContext = {
  root: string;
  page: string;
  pagePath: string;
  outDir: string;
  buildDir: string;
  id: string;
  minify: boolean;
  keep: number;
  mode: string;
  data: Map<string, unknown>;
  importMap: ImportMap;
  parsed: ParsedPage;
  moduleOutputs: (string | undefined)[];
  styleOutputs: (string | undefined)[];
  outputs: Map<string, Uint8Array | string>;
  log: BuildLog;
};

/** A named step over the build context. */
export type BuildStep = { name: string; run(ctx: BuildContext): Promise<void> | void };

/** What `build` needs: the app root and, optionally, the page, the output folder, minification, retention, the mode, shared data, extra steps and a log. */
export type BuildOptions = {
  root: string;
  page?: string;
  outDir?: string;
  minify?: boolean;
  keep?: number;
  mode?: string;
  data?: Map<string, unknown>;
  steps?: readonly BuildStep[];
  log?: BuildLog;
};
