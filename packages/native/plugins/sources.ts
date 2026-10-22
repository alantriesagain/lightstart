/**
 * @file A plugin's source as the engine takes it: the file it came from (named in its errors) and its
 * code; and the sources of a folder, the `.js` files by name.
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

/** The `.js` files of `dir`, by name ([] when it does not exist). */
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
    if (!name.endsWith(".js")) continue;
    const path = join(dir, name);
    try {
      if (!statSync(path).isFile()) continue;
      out.push(new PluginSource(path, readFileSync(path, "utf8")));
    } catch {
      continue;
    }
  }
  return out;
};
