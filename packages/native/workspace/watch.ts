/**
 * @file The folder's changes as batches of paths, adapted from bootstrapp's TreeWatch. Natively
 * `fs.watch` is per directory and its listener gets no file name, so each watched directory
 * keeps a snapshot of its entries (mtime, or -1 for a directory) and an event only marks it
 * dirty; once a batch window passes, every dirty directory is re-read once and what differs is
 * reported by folder-relative path. The directories watched are the ones holding the folder's
 * listed files (git's view: ignored trees are never walked); a directory that appears is watched
 * unless its name is a usual dependency or build directory. The git directory is watched on its
 * own: any event there (index, HEAD, refs) sets `git` in the batch.
 */
import { lstatSync, readdirSync, watch } from "node:fs";
import { join } from "node:path";
import { Closer } from "@light/lib/timing.ts";
import { joinRel, SKIP_DIRS } from "@light/lib/paths.ts";

const MAX_DIRS = 4000;

export class ChangeBatch {
  /** Files and directories added, removed or modified, folder-relative, sorted. */
  paths: string[] = [];
  /** True when an entry was added or removed (the page reloads its file list). */
  structure = false;
  /** True when the repository's git directory changed (the page reloads status). */
  git = false;
  /** Events folded into this batch. */
  events = 0;
}

export class TreeWatch {
  /** Receives one batch per window with at least one event. */
  onBatch: ((batch: ChangeBatch) => void) | null = null;
  onWarn: ((text: string) => void) | null = null;
  readonly folder: string;
  readonly batchMs: number;
  private closers = new Map<string, Closer>();
  private snapshots = new Map<string, Map<string, number>>();
  private dirty = new Set<string>();
  private gitDirty = false;
  private events = 0;
  private queued = false;
  private capped = false;
  private closed = false;

  constructor(folder: string, batchMs: number) {
    this.folder = folder;
    this.batchMs = batchMs;
  }

  get watchedCount(): number {
    return this.closers.size;
  }

  /** Watch `dirs` (folder-relative, "" for the folder) and, when not "", the git directory. */
  start(dirs: string[], gitDir: string): void {
    for (const d of dirs) this.watchDir(d);
    if (gitDir.length > 0)
      try {
        const w = watch(gitDir, () => this.markGit());
        this.closers.set("\0git", new Closer(() => w.close()));
      } catch {
        this.warn("cannot watch " + gitDir);
      }
  }

  /** Watch the directories of a fresh listing that are not watched yet; release the ones gone. */
  sync(dirs: string[]): void {
    const keep = new Set<string>();
    for (const d of dirs) {
      keep.add(d);
      this.watchDir(d);
    }
    const gone: string[] = [];
    for (const d of this.snapshots.keys()) if (!keep.has(d) && !this.exists(d)) gone.push(d);
    for (const d of gone) this.release(d);
  }

  close(): void {
    this.closed = true;
    for (const c of this.closers.values()) c.unwatch();
    this.closers.clear();
    this.snapshots.clear();
    this.dirty.clear();
  }

  private abs(dir: string): string {
    return dir.length > 0 ? join(this.folder, dir) : this.folder;
  }

  private exists(dir: string): boolean {
    try {
      return lstatSync(this.abs(dir)).isDirectory();
    } catch {
      return false;
    }
  }

  private snapshot(dir: string): Map<string, number> {
    const entries = new Map<string, number>();
    let names: string[];
    try {
      names = readdirSync(this.abs(dir));
    } catch {
      return entries;
    }
    for (const name of names)
      try {
        const st = lstatSync(join(this.abs(dir), name));
        entries.set(name, st.isDirectory() && !st.isSymbolicLink() ? -1 : st.mtimeMs);
      } catch {
        continue;
      }
    return entries;
  }

  private watchDir(dir: string): void {
    if (this.closers.has(dir) || this.closed) return;
    if (this.snapshots.size >= MAX_DIRS) {
      if (!this.capped) this.warn("more than " + String(MAX_DIRS) + " directories under " + this.folder + "; deeper changes are not reported");
      this.capped = true;
      return;
    }
    const entries = this.snapshot(dir);
    try {
      const w = watch(this.abs(dir), () => this.mark(dir));
      this.closers.set(dir, new Closer(() => w.close()));
    } catch {
      this.warn("cannot watch " + this.abs(dir));
      return;
    }
    this.snapshots.set(dir, entries);
  }

  private release(dir: string): void {
    const under: string[] = [];
    for (const d of this.snapshots.keys()) if (d === dir || d.startsWith(dir + "/") || dir.length === 0) under.push(d);
    for (const d of under) {
      const c = this.closers.get(d);
      if (c !== undefined) c.unwatch();
      this.closers.delete(d);
      this.snapshots.delete(d);
      this.dirty.delete(d);
    }
  }

  private mark(dir: string): void {
    this.dirty.add(dir);
    this.events++;
    this.queue();
  }

  private markGit(): void {
    this.gitDirty = true;
    this.events++;
    this.queue();
  }

  private queue(): void {
    if (this.queued || this.closed) return;
    this.queued = true;
    setTimeout(() => this.flush(), this.batchMs);
  }

  private flush(): void {
    this.queued = false;
    if (this.closed) return;
    const batch = new ChangeBatch();
    batch.git = this.gitDirty;
    batch.events = this.events;
    this.gitDirty = false;
    this.events = 0;
    const dirs: string[] = [];
    for (const d of this.dirty) dirs.push(d);
    this.dirty.clear();
    const changed = new Set<string>();
    for (const dir of dirs) this.rescan(dir, changed, batch);
    for (const p of changed) batch.paths.push(p);
    batch.paths.sort();
    if (batch.paths.length === 0 && !batch.git) return;
    const fn = this.onBatch;
    if (fn !== null) fn(batch);
  }

  private rescan(dir: string, changed: Set<string>, batch: ChangeBatch): void {
    const before = this.snapshots.get(dir);
    if (before === undefined) return;
    if (!this.exists(dir)) {
      this.release(dir);
      changed.add(dir);
      batch.structure = true;
      return;
    }
    const after = this.snapshot(dir);
    this.snapshots.set(dir, after);
    for (const [name, mtime] of after) {
      const previous = before.get(name);
      const path = joinRel(dir, name);
      if (previous === undefined) {
        changed.add(path);
        batch.structure = true;
        if (mtime === -1 && !SKIP_DIRS.includes(name)) {
          this.watchDir(path);
          this.addTree(path, changed);
        }
      } else if (previous !== mtime && mtime !== -1) changed.add(path);
    }
    for (const [name, mtime] of before)
      if (!after.has(name)) {
        const path = joinRel(dir, name);
        changed.add(path);
        batch.structure = true;
        if (mtime === -1) this.release(path);
      }
  }

  /** A directory that appeared may already hold files and directories (a move, `mkdir -p`). */
  private addTree(dir: string, changed: Set<string>): void {
    const entries = this.snapshots.get(dir);
    if (entries === undefined) return;
    for (const [name, mtime] of entries) {
      const path = joinRel(dir, name);
      changed.add(path);
      if (mtime === -1 && !SKIP_DIRS.includes(name)) {
        this.watchDir(path);
        this.addTree(path, changed);
      }
    }
  }

  private warn(text: string): void {
    const fn = this.onWarn;
    if (fn !== null) fn("[watch] " + text);
  }
}
