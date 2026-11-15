/**
 * @file Which scriptc the native tools run, light's and the `light` commands' alike: the
 * executable named by `$SCRIPTC` when it is set, else the one installed at the project's root
 * (`<project>/node_modules/.bin/scriptc`), else the one installed beside `@lightstart/native`,
 * else `scriptc` on PATH. `SCRIPTC_CACHE_MAX_MB` and the other `SCRIPTC_*` variables pass through
 * to the compiler.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * The scriptc installed beside `@lightstart/native`, at its own folder or the nearest folder above
 * it whose `node_modules/.bin/scriptc` exists.
 * @returns {string | null}
 */
const besideNative = () => {
  let dir = resolve(import.meta.dirname, "..", "..", "native");
  for (;;) {
    const bin = join(dir, "node_modules", ".bin", "scriptc");
    if (existsSync(bin)) return bin;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
};

/**
 * @param {string} root the folder whose `node_modules` may hold scriptc
 * @returns {string}
 */
export const scriptcPath = (root) => {
  const named = process.env.SCRIPTC;
  if (named !== undefined && named.length > 0) return named;
  const local = join(root, "node_modules", ".bin", "scriptc");
  if (existsSync(local)) return local;
  return besideNative() ?? "scriptc";
};
