/**
 * @file The hook a file under `cli/hooks/` answers to: `serve.after.ts` is `serve:after`.
 */

/** The hook a relative hook file names. */
export const hookNameOf = (relativeFile: string): string => relativeFile.replace(/\.(?:js|ts|mjs)$/, "").replace(/[/.]/g, ":");
