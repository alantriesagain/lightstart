/**
 * @file The folder's files: in a git work tree, what git would show (tracked plus untracked, ignored
 * left out); elsewhere a walk that skips the usual dependency and build directories and stops
 * at a cap. A read is capped, positioned, and refuses paths that leave the folder.
 *
 * A symlink is a file in the listing: following it could walk back into the folder forever.
 */
import { closeSync, lstatSync, openSync, readdirSync, readSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import { addParentDirs, joinRel, SKIP_DIRS } from "@light/lib/paths.ts";
import { isBinary } from "./git.ts";
import { git } from "./git.read.ts";

const MAX_WALK = 20000;

export class FileList {
  paths: string[] = [];
  /** True when the walk stopped at its cap, or git's listing was cut. */
  truncated = false;
}

export class FileContent {
  path = "";
  exists = false;
  size = 0;
  mtimeMs = 0;
  binary = false;
  truncated = false;
  text = "";
}

/** `rel` inside `folder` (no "..", not absolute), as an absolute path; "" when it leaves it. */
export const insidePath = (folder: string, rel: string): string => {
  if (rel.length === 0 || rel.startsWith("/") || rel.includes("\0")) return "";
  const n = normalize(rel);
  if (n === ".." || n.startsWith("../") || n.startsWith("/")) return "";
  return join(folder, n);
};

const walk = (folder: string, dir: string, list: FileList): void => {
  let names: string[];
  try {
    names = readdirSync(join(folder, dir));
  } catch {
    return;
  }
  names.sort();
  for (const name of names) {
    if (list.paths.length >= MAX_WALK) {
      list.truncated = true;
      return;
    }
    const rel = joinRel(dir, name);
    let isDir = false;
    try {
      const st = lstatSync(join(folder, rel));
      isDir = !st.isSymbolicLink() && st.isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      if (!SKIP_DIRS.includes(name)) walk(folder, rel, list);
    } else list.paths.push(rel);
  }
};

export const listFiles = async (folder: string, isRepo: boolean): Promise<FileList> => {
  const list = new FileList();
  if (!isRepo) {
    walk(folder, "", list);
    return list;
  }
  const run = await git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], folder, 64 * 1024 * 1024, 30000);
  if (!run.ok) throw new Error("git ls-files: " + run.err);
  const seen = new Set<string>();
  for (const p of run.text.split("\0"))
    if (p.length > 0 && !seen.has(p)) {
      seen.add(p);
      list.paths.push(p);
    }
  list.paths.sort();
  list.truncated = run.truncated;
  return list;
};

/** The directories holding `paths` (and their parents), "" for the folder itself. */
export const directoriesOf = (paths: string[]): string[] => {
  const dirs = new Set<string>();
  dirs.add("");
  for (const p of paths) addParentDirs(p, dirs);
  const out: string[] = [];
  for (const d of dirs) out.push(d);
  out.sort();
  return out;
};

export const readFileCapped = (folder: string, rel: string, maxBytes: number): FileContent => {
  const file = new FileContent();
  file.path = rel;
  const abs = insidePath(folder, rel);
  if (abs.length === 0) return file;
  let size = 0;
  try {
    const st = statSync(abs);
    if (!st.isFile()) return file;
    size = st.size;
    file.mtimeMs = st.mtimeMs;
  } catch {
    return file;
  }
  file.exists = true;
  file.size = size;
  const length = size < maxBytes ? size : maxBytes;
  const buf = Buffer.alloc(length);
  const fd = openSync(abs, "r");
  let n = 0;
  try {
    n = readSync(fd, buf, 0, length, 0);
  } finally {
    closeSync(fd);
  }
  const got = buf.subarray(0, n);
  file.truncated = size > n;
  if (isBinary(got)) file.binary = true;
  else file.text = got.toString("utf8");
  return file;
};
