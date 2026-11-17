/**
 * @file A plugin's source as the engine takes it: the file it came from (named in its errors) and its
 * code; the sources of a folder, its `.js` files and its subfolders holding an `index.js`, by name;
 * and a plugin of its own folder's files, which its ES modules import.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

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

/** Whether `file` is a plugin of its own folder: an `index.js` there. */
export const isFolderPlugin = (file: string): boolean => basename(file) === "index.js" && existsSync(file);

/** The `.js` files of a folder plugin whose entry is `index`, its subfolders' too, by path: what its modules may import. */
export const moduleFilesOf = (index: string): PluginSource[] => filesUnder(dirname(index));

/** The folder of a folder plugin whose entry is `index`, and the folders under it: what to watch for a change. */
export const foldersOf = (index: string): string[] => foldersUnder(dirname(index));

/** What a folder plugin's files are now, to tell a change in any of them. */
export const printOf = (files: readonly PluginSource[]): string => files.map((f) => f.file + "\n" + f.code).join("\n\u0000\n");

const filesUnder = (dir: string): PluginSource[] => {
  const out: PluginSource[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    const path = join(dir, name);
    try {
      if (statSync(path).isDirectory()) for (const f of filesUnder(path)) out.push(f);
      else if (name.endsWith(".js")) out.push(new PluginSource(path, readFileSync(path, "utf8")));
    } catch {
      continue;
    }
  }
  return out;
};

const foldersUnder = (dir: string): string[] => {
  const out = [dir];
  let names: string[] = [];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    const path = join(dir, name);
    try {
      if (statSync(path).isDirectory()) for (const f of foldersUnder(path)) out.push(f);
    } catch {
      continue;
    }
  }
  return out;
};
