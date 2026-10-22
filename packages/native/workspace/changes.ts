/**
 * @file What changed in the folder, for the changes bar: each file git reports against the base (HEAD,
 * or the commit the Git tab compares with) with its lines added and removed (`diff --numstat`; an
 * untracked file counts all its lines), the last time it changed (the watcher's batches and
 * the agent's edits as they happen; before either, the file's mtime) and whether the agent edited it in
 * this session. Newest first, so what is changing now leads.
 */
import { statSync } from "node:fs";
import { stampOf } from "@light/lib/fs.ts";
import { join } from "node:path";
import { readFileCapped } from "./files.ts";
import { GitEntry, GitRepo } from "./git.ts";
import { git } from "./git.read.ts";
import { LineCount, parseNameStatus, parseNumstat } from "./git-parse.ts";

/** Past this size an untracked file's lines are not counted. */
const COUNT_MAX = 1024 * 1024;

export class FileChange {
  /** Relative to the folder. */
  path = "";
  /** The git mark: M, A, D, R, U (untracked) or ! (conflict). */
  mark = "";
  added = 0;
  removed = 0;
  /** Git cannot count lines in it. */
  binary = false;
  /** When it last changed (epoch ms; 0 when unknown, a deleted file). */
  changedMs = 0;
  /** The agent edited it in this session. */
  byAgent = false;
}

/** Lines added and removed against `base`, by folder-relative path ({} outside a repository or without a commit). */
export const readNumstat = async (repo: GitRepo, folder: string, base: string): Promise<Map<string, LineCount>> => {
  if (!repo.isRepo) return new Map<string, LineCount>();
  const run = await git(["diff", "--numstat", "-z", "--relative", "--no-renames", "--no-ext-diff", base, "--", "."], folder, 16 * 1024 * 1024);
  return run.ok ? parseNumstat(run.text) : new Map<string, LineCount>();
};

/**
 * The marks against `base` (a commit other than HEAD): what `diff --name-status` says changed
 * between it and the work tree, plus the untracked files from `entries` (git status).
 */
export const readBaseMarks = async (repo: GitRepo, folder: string, base: string, entries: GitEntry[]): Promise<Map<string, string>> => {
  const marks = new Map<string, string>();
  if (!repo.isRepo) return marks;
  const run = await git(["diff", "--name-status", "-z", "--relative", "--no-renames", base, "--", "."], folder, 16 * 1024 * 1024);
  if (run.ok) for (const [path, mark] of parseNameStatus(run.text)) marks.set(path, mark);
  for (const e of entries) if (e.x === "?" && e.y === "?") marks.set(e.path, "U");
  return marks;
};

/** An untracked file's lines, all added; counted again only when its size or mtime moved. */
export class UntrackedCounter {
  private cache = new Map<string, LineCount>();
  private keys = new Map<string, string>();

  count(folder: string, path: string): LineCount {
    const key = stampOf(join(folder, path));
    if (key === "-") return new LineCount();
    const cached = this.cache.get(path);
    if (cached !== undefined && this.keys.get(path) === key) return cached;
    const c = new LineCount();
    const file = readFileCapped(folder, path, COUNT_MAX);
    if (file.binary || file.truncated) c.binary = true;
    else if (file.text.length > 0) {
      let n = 0;
      for (let i = 0; i < file.text.length; i++) if (file.text.charCodeAt(i) === 10) n++;
      c.added = file.text.endsWith("\n") ? n : n + 1;
    }
    this.cache.set(path, c);
    this.keys.set(path, key);
    return c;
  }
}

const mtimeOf = (folder: string, path: string): number => {
  try {
    return statSync(join(folder, path)).mtimeMs;
  } catch {
    return 0;
  }
};

/**
 * The changed files: every marked path, its counts, its last change (`times`, else its mtime) and
 * whether the agent edited it (`edited`, folder-relative); newest first, then by path.
 */
export const buildChanges = (folder: string, marks: Map<string, string>, counts: Map<string, LineCount>, untracked: UntrackedCounter, times: Map<string, number>, edited: Set<string>, mtimes: Map<string, number> = new Map()): FileChange[] => {
  const out: FileChange[] = [];
  for (const path of marks.keys()) {
    const mark = marks.get(path) ?? "";
    if (mark.length === 0) continue;
    const f = new FileChange();
    f.path = path;
    f.mark = mark;
    const c = mark === "U" ? untracked.count(folder, path) : counts.get(path);
    if (c !== undefined) {
      f.added = c.added;
      f.removed = c.removed;
      f.binary = c.binary;
    }
    const t = times.get(path);
    if (t !== undefined) f.changedMs = t;
    else if (mark === "D") f.changedMs = 0;
    else {
      let m = mtimes.get(path);
      if (m === undefined) {
        m = mtimeOf(folder, path);
        mtimes.set(path, m);
      }
      f.changedMs = m;
    }
    f.byAgent = edited.has(path);
    out.push(f);
  }
  out.sort((a, b) => (a.changedMs !== b.changedMs ? b.changedMs - a.changedMs : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
};
