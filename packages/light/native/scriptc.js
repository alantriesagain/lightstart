/**
 * @file Which scriptc the native tools run, light's and `light-native`'s alike: the executable
 * named by `$SCRIPTC` when it is set, else the fork's `scriptc-dev` on `PATH`, else the scriptc
 * installed in the given folder's `node_modules`, else the one on `PATH`. Light's TypeScript core
 * needs patches no release carries yet (`native/README.md`, "Which scriptc"), so the fork comes
 * before a release.
 */
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * @param {string} root the folder whose `node_modules` may hold scriptc
 * @returns {string}
 */
export const scriptcPath = (root) => {
  const named = process.env.SCRIPTC;
  if (named !== undefined && named.length > 0) return named;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) if (dir.length > 0 && existsSync(join(dir, "scriptc-dev"))) return join(dir, "scriptc-dev");
  const local = join(root, "node_modules", ".bin", "scriptc");
  return existsSync(local) ? local : "scriptc";
};
