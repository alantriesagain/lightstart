/**
 * @file The files column's model: the folder's paths (git's list plus what status names, so a staged
 * deletion still shows) as nested directories, flattened into the rows the expanded folders make
 * visible, each with its git mark; a directory holding a change carries a dot. Plain data, with no
 * view code (see probes/p36: a module importing light links badly natively when it also holds an
 * unawaited Promise, as git.ts does).
 */
import { addParentDirs, joinRel } from "@light/lib/paths.ts";
import { GitEntry } from "./git.ts";

export class Dir {
  name: string;
  path: string;
  dirs = new Map<string, Dir>();
  files: string[] = [];

  constructor(name: string, path: string) {
    this.name = name;
    this.path = path;
  }
}

export class Row {
  path: string;
  name: string;
  depth: number;
  dir: boolean;
  open: boolean;
  mark: string;

  constructor(path: string, name: string, depth: number, dir: boolean, open: boolean, mark: string) {
    this.path = path;
    this.name = name;
    this.depth = depth;
    this.dir = dir;
    this.open = open;
    this.mark = mark;
  }
}

/** The one letter a file's status shows: "U" untracked, "!" conflicted, else D, R, A or M. */
export const markOf = (e: GitEntry): string => {
  if (e.x === "?" && e.y === "?") return "U";
  if (e.x === "U" || e.y === "U" || (e.x === "A" && e.y === "A") || (e.x === "D" && e.y === "D")) return "!";
  if (e.y === "D" || e.x === "D") return "D";
  if (e.x === "R" || e.y === "R") return "R";
  if (e.x === "A") return "A";
  return "M";
};

export const marksOf = (entries: GitEntry[]): Map<string, string> => {
  const marks = new Map<string, string>();
  for (const e of entries) marks.set(e.path, markOf(e));
  return marks;
};

/** Every directory holding a marked file ("" left out). */
export const changedDirs = (marks: Map<string, string>): Set<string> => {
  const dirs = new Set<string>();
  for (const path of marks.keys()) addParentDirs(path, dirs);
  return dirs;
};

export const buildTree = (paths: string[]): Dir => {
  const root = new Dir("", "");
  const seen = new Set<string>();
  for (const path of paths) {
    if (path.length === 0 || seen.has(path)) continue;
    seen.add(path);
    const parts = path.split("/");
    let at = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let next = at.dirs.get(parts[i]);
      if (next === undefined) {
        next = new Dir(parts[i], parts.slice(0, i + 1).join("/"));
        at.dirs.set(parts[i], next);
      }
      at = next;
    }
    at.files.push(parts[parts.length - 1]);
  }
  return root;
};

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const walk = (d: Dir, depth: number, expanded: Set<string>, marks: Map<string, string>, changed: Set<string>, changedOnly: boolean, rows: Row[]): void => {
  const names: string[] = [];
  for (const name of d.dirs.keys()) names.push(name);
  names.sort(byName);
  for (const name of names) {
    const child = d.dirs.get(name);
    if (child === undefined) continue;
    const has = changed.has(child.path);
    if (changedOnly && !has) continue;
    const open = changedOnly || expanded.has(child.path);
    rows.push(new Row(child.path, name, depth, true, open, has ? "•" : ""));
    if (open) walk(child, depth + 1, expanded, marks, changed, changedOnly, rows);
  }
  const files = d.files.slice();
  files.sort(byName);
  for (const name of files) {
    const path = joinRel(d.path, name);
    const mark = marks.get(path) ?? "";
    if (changedOnly && mark.length === 0) continue;
    rows.push(new Row(path, name, depth, false, false, mark));
  }
};

/**
 * The visible rows: directories first, then files, each sorted by name; a directory's children
 * show when it is in `expanded`. With `changedOnly`, only marked files and the directories that
 * lead to them, all open.
 */
export const visibleRows = (root: Dir, expanded: Set<string>, marks: Map<string, string>, changedOnly: boolean): Row[] => {
  const rows: Row[] = [];
  walk(root, 0, expanded, marks, changedDirs(marks), changedOnly, rows);
  return rows;
};

/** The directories to open so `path` shows. */
export const ancestors = (path: string): string[] => {
  const out: string[] = [];
  let cut = path.indexOf("/");
  while (cut > 0) {
    out.push(path.slice(0, cut));
    cut = path.indexOf("/", cut + 1);
  }
  return out;
};

