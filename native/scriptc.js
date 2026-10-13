/**
 * @file Which scriptc light's native tools run: the executable named by
 * `$SCRIPTC` when it is set, else the one installed in light's
 * `node_modules`. Light's TypeScript sources keep `unknown`-typed class
 * fields, which need a scriptc built with that support (see
 * `native/README.md`), so `SCRIPTC` points at such a build until a release
 * carries it.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} light light's directory
 * @returns {string}
 */
export const scriptcPath = (light) => {
  if (process.env.SCRIPTC) return process.env.SCRIPTC;
  const local = join(light, "node_modules", ".bin", "scriptc");
  return existsSync(local) ? local : "scriptc";
};
