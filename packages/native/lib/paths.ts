/**
 * @file Paths as the core walks them: the directory names a listing never enters and the watcher never
 * follows (dependencies, build output, caches), a folder-relative join, the directories above a
 * path, and a path the user typed with `~` for the home folder.
 */
import { homedir } from "node:os";
import { join } from "node:path";

/** Directory names a walk never enters and the watcher never follows. */
export const SKIP_DIRS: string[] = ["node_modules", ".git", "dist", "build", "out", "target", ".venv", "__pycache__", ".next", ".cache"];

/** `name` under the folder-relative `dir` ("" is the folder itself). */
export const joinRel = (dir: string, name: string): string => (dir.length > 0 ? dir + "/" + name : name);

/** Add to `dirs` every directory above `path` (the folder itself left out), stopping at one already there. */
export const addParentDirs = (path: string, dirs: Set<string>): void => {
  let cut = path.lastIndexOf("/");
  while (cut > 0) {
    const d = path.slice(0, cut);
    if (dirs.has(d)) break;
    dirs.add(d);
    cut = d.lastIndexOf("/");
  }
};

/** `path` as typed: `~` and `~/...` in the home folder, anything else as it is. */
export const expandHome = (path: string): string => {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
};
