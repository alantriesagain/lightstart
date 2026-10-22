/**
 * @file The compiler the commands build with: $SCRIPTC names it, else the fork's `scriptc-dev` on PATH
 * (upstream lacks the fork's patches and fails on light), else the one installed at the root.
 */
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * @param {string} root
 * @returns {string}
 */
export const scriptcPath = (root) => {
  const named = process.env["SCRIPTC"];
  if (named !== undefined && named.length > 0) return named;
  for (const dir of (process.env["PATH"] ?? "").split(delimiter)) if (dir.length > 0 && existsSync(join(dir, "scriptc-dev"))) return join(dir, "scriptc-dev");
  const local = join(root, "node_modules", ".bin", "scriptc");
  if (existsSync(local)) return local;
  throw new Error("no compiler: set SCRIPTC, put scriptc-dev on PATH, or install scriptc at the root");
};
