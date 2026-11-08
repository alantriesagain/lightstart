/**
 * @lightstart/light/check/parse/typescript.js: the TypeScript compiler API the
 * parsers and rules read. `typescript` when it is version 6; otherwise
 * `@typescript/typescript6`, since TypeScript 7's `typescript` no longer
 * exports that API. Resolved without waiting, so `loadRulesSync` can load the
 * rules that import it.
 */

import { createRequire } from "node:module";
import { TYPESCRIPT_HINT } from "../cli.js";

/** @type {(id: string) => unknown} */
const require = createRequire(import.meta.url);

/** @returns {typeof import("typescript")} */
const resolve = () => {
  try {
    const ts = /** @type {typeof import("typescript")} */ (require("typescript"));
    if (ts.version.startsWith("6.")) return ts;
  } catch {}
  try {
    return /** @type {typeof import("typescript")} */ (require("@typescript/typescript6"));
  } catch {
    throw new Error(TYPESCRIPT_HINT);
  }
};

export default resolve();
