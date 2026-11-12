/**
 * @file Which scriptc the native tools run, light's and `light-native`'s alike: the executable
 * named by `$SCRIPTC` when it is set, else the scriptc installed in the given folder's
 * `node_modules`, else the one on `PATH`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} root the folder whose `node_modules` may hold scriptc
 * @returns {string}
 */
export const scriptcPath = (root) => {
  const named = process.env.SCRIPTC;
  if (named !== undefined && named.length > 0) return named;
  const local = join(root, "node_modules", ".bin", "scriptc");
  return existsSync(local) ? local : "scriptc";
};
