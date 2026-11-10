/**
 * @file A plugin's source as the engine takes it: the file it came from (named in its errors) and its
 * code; and the sources of a folder, its `.js` files and its subfolders holding an `index.js`, by name.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export class PluginSource {
  readonly file: string;
  readonly code: string;

  constructor(file: string, code: string) {
    this.file = file;
    this.code = code;
  }
}

/** The `.js` files of `dir` and the `index.js` of each subfolder that has one, by name ([] when it does not exist). */
export const sourcesIn = (dir: string): PluginSource[] => {
  const out: PluginSource[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  names.sort();
  for (const name of names) {
    const path = join(dir, name);
    try {
      const st = statSync(path);
      if (st.isDirectory()) {
        // A plugin of its own folder: its index.js, the folder's other files beside it.
        const index = join(path, "index.js");
        if (statSync(index).isFile()) out.push(new PluginSource(index, readFileSync(index, "utf8")));
        continue;
      }
      if (!name.endsWith(".js") || !st.isFile()) continue;
      out.push(new PluginSource(path, readFileSync(path, "utf8")));
    } catch {
      continue;
    }
  }
  return out;
};
