/**
 * @file Bundle the package's worker into the one self-contained script a
 * service worker must be: esbuild inlines `worker/logic.ts` with splitting
 * off, and `define` bakes in the precache list, the version and the base.
 */

import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

/** What a built worker holds: its precache paths, its version, the app's base, and whether the build minifies. */
export interface WorkerValues {
  precache: readonly string[];
  version: string;
  base: string;
  minify?: boolean;
}

const entry = fileURLToPath(new URL("../worker/worker.ts", import.meta.url));

/** The worker's JavaScript, self-contained and with the build's values baked in. */
export const workerSource = async (values: WorkerValues): Promise<string> => {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    splitting: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    minify: values.minify === true,
    logLevel: "silent",
    define: {
      __PWA_PRECACHE__: JSON.stringify(values.precache),
      __PWA_VERSION__: JSON.stringify(values.version),
      __PWA_BASE__: JSON.stringify(values.base),
    },
  });
  const output = result.outputFiles?.[0];
  if (output === undefined) throw new Error("esbuild wrote no service worker output");
  return output.text;
};
