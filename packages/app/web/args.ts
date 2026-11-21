/// <reference lib="dom" />
/**
 * @file The web host's URL arguments, imported only when the app declares
 * `args`: the query (`?name=value`, a bare `?flag`) as argv tokens, parsed
 * against the app's schema. An app without arguments never imports the parser
 * and the host answers no values.
 */

import { parseArgs } from "@lightstart/cli/argv.ts";
import type { App } from "../index.ts";

/** The URL query as argv tokens for the app's own arguments: `?name=value` and a bare `?flag`; a parameter the app does not declare is left out. */
const queryArgv = (app: App): string[] => {
  const out: string[] = [];
  const query = new URLSearchParams(globalThis.location?.search ?? "");
  for (const [key, value] of query) {
    const spec = app.argsSchema[key];
    if (spec === undefined) continue;
    if ("flag" in spec && spec.flag === true) {
      if (value === "" || value === "true") out.push("--" + key);
    } else out.push("--" + key, value);
  }
  return out;
};

/** Parse the page's URL query into the app's arguments. */
export const queryArgs = (app: App): Record<string, unknown> => parseArgs(app.argsSchema, queryArgv(app)) as Record<string, unknown>;
