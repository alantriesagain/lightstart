/**
 * @file Files as the core keeps them: a whole text read with a fallback, a text written whole in one
 * step (beside the file, then renamed over it, the folder made), and a file's stamp for a cheap
 * "did it change" (its size and modification time, the time floored so node and a native build
 * write the same digits).
 */
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let writes = 0;

/** The file's text, or `fallback` when it cannot be read. */
export const readTextOr = (path: string, fallback: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return fallback;
  }
};

/** Write `text` as the whole of `path` in one step, the folder made when it is missing. The temp name is this process's and this write's, so two processes never share one. */
export const writeAtomic = (path: string, text: string): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = path + "." + String(process.pid) + "." + String(++writes) + ".tmp";
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
    }
    throw err;
  }
};

/** The file's size and modification time as one string, "-" for a file that cannot be read. */
export const stampOf = (path: string): string => {
  try {
    const st = statSync(path);
    return String(st.size) + ":" + String(Math.floor(st.mtimeMs));
  } catch {
    return "-";
  }
};
