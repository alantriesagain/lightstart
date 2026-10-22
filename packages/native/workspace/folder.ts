/**
 * @file The folder as the host reads it: its files, its git status against the compare base (the marks
 * and the lines added and removed), the base itself, the watcher's latest batch and when each file
 * last changed, and the tree built from the files. The files, the status and the base are signals
 * holding a snapshot each, replaced whole by a load, so a render reading one follows it; the hooks
 * announce the same loads to plugins. One per folder: `/open` makes another, with the same hooks,
 * the host's, so the listeners stay. One of light's controllers, as the app's state is.
 */
import { signal } from "@bootstrapp/light/signals";
import { Controller } from "@bootstrapp/light/controller/class.ts";
import { Hook } from "@light/lib/hook.ts";
import { Latest } from "@light/lib/timing.ts";
import { buildChanges, FileChange, readBaseMarks, readNumstat, UntrackedCounter } from "./changes.ts";
import { LineCount } from "./git-parse.ts";
import { FileList } from "./files.ts";
import { buildTree, Dir, marksOf } from "./tree.ts";
import { ChangeBatch } from "./watch.ts";
import { Workspace } from "./workspace.ts";

/** Git status against the compare base: the branch, each changed path's mark, and the lines added and removed. */
export class FolderStatus {
  branch = "";
  marks = new Map<string, string>();
  counts = new Map<string, LineCount>();
}

/** The folder's announcements, the host's across folders so plugins' listeners stay: the files were loaded, the status was read, the watcher saw changes, the compare base changed. */
export class FolderHooks {
  readonly filesLoaded = new Hook();
  readonly statusLoaded = new Hook();
  readonly folderChanged = new Hook();
  readonly baseChanged = new Hook();
}

/** What changes are compared with: "HEAD" or a commit; its kind ("head", "branch", "session") and name. */
export class CompareBase {
  readonly base: string;
  readonly kind: string;
  readonly name: string;

  constructor(base: string, kind: string, name: string) {
    this.base = base;
    this.kind = kind;
    this.name = name;
  }
}

const sameMarks = (a: Map<string, string>, b: Map<string, string>): boolean => {
  if (a.size !== b.size) return false;
  for (const [path, mark] of a) if (b.get(path) !== mark) return false;
  return true;
};

export class FolderController extends Controller {
  readonly workspace: Workspace;
  readonly files = signal(new FileList());
  readonly status = signal(new FolderStatus());
  readonly base = signal(new CompareBase("HEAD", "head", "HEAD"));
  /** The watcher's latest batch, for `folderChanged` listeners. */
  batch = new ChangeBatch();
  readonly hooks: FolderHooks;
  /** Called with a line worth logging. */
  onNote: ((text: string) => void) | null = null;
  /** When each path last changed (the watcher's batches, the agent's edits); untracked files' lines. */
  private changeTimes = new Map<string, number>();
  private readonly untracked = new UntrackedCounter();
  /** The folder's tree, and the file list and marks it was built from. */
  private treeCache = new Dir("", "");
  private treePaths: string[] | null = null;
  private treeMarks: Map<string, string> | null = null;
  private statusBusy = false;
  private statusAgain = false;
  private readonly filesTicket = new Latest();
  private readonly mtimes = new Map<string, number>();

  constructor(workspace: Workspace, hooks: FolderHooks) {
    super("folder");
    this.workspace = workspace;
    this.hooks = hooks;
    workspace.onChanges = (b: ChangeBatch) => this.received(b);
  }

  folderName(): string {
    const f = this.workspace.folder;
    return f.slice(f.lastIndexOf("/") + 1);
  }

  /** A path the agent named, relative to the folder; "" outside it. */
  relative(path: string): string {
    const folder = this.workspace.folder;
    return path.startsWith(folder + "/") ? path.slice(folder.length + 1) : path.startsWith("/") ? "" : path;
  }

  /** The files, the marks, the counts and the branch as last loaded, without tracking (a render reads the signals). */
  paths(): string[] {
    return this.files.peek().paths;
  }

  truncated(): boolean {
    return this.files.peek().truncated;
  }

  marks(): Map<string, string> {
    return this.status.peek().marks;
  }

  counts(): Map<string, LineCount> {
    return this.status.peek().counts;
  }

  branch(): string {
    return this.status.peek().branch;
  }

  markOf(path: string): string {
    return this.marks().get(path) ?? "";
  }

  changedCount(): number {
    let n = 0;
    for (const m of this.marks().values()) if (m.length > 0) n++;
    return n;
  }

  /** The folder's tree: the file list and what status names (a staged deletion still shows), built again when either was read again. */
  tree(): Dir {
    const paths = this.paths();
    const marks = this.marks();
    if (this.treePaths !== paths || this.treeMarks !== marks) {
      const all = paths.slice();
      for (const p of marks.keys()) all.push(p);
      this.treeCache = buildTree(all);
      this.treePaths = paths;
      this.treeMarks = marks;
    }
    return this.treeCache;
  }

  /** The changed files against the compare base, newest first: their marks and lines, when each changed, those in `agentEdited` (folder-relative) marked as the agent's. */
  changes(agentEdited: Set<string>): FileChange[] {
    return buildChanges(this.workspace.folder, this.marks(), this.counts(), this.untracked, this.changeTimes, agentEdited, this.mtimes);
  }

  /** The agent edited `rel` (folder-relative): a change to it now. */
  noteEdit(rel: string): void {
    this.changeTimes.set(rel, Date.now());
  }

  /** Load the file list and git status. */
  async load(): Promise<void> {
    await Promise.all([this.loadFiles(), this.loadStatus()]);
  }

  async loadFiles(): Promise<void> {
    const ticket = this.filesTicket.next();
    const files = await this.workspace.files();
    if (!this.filesTicket.is(ticket)) return;
    this.files.value = files;
    this.hooks.filesLoaded.fire();
  }

  /** Git status and line counts against the compare base, one read at a time (a request meanwhile reads once more after). */
  async loadStatus(): Promise<void> {
    if (this.statusBusy) {
      this.statusAgain = true;
      return;
    }
    this.statusBusy = true;
    try {
      do {
        this.statusAgain = false;
        const base = this.base.peek().base;
        this.mtimes.clear();
        const s = await this.workspace.status();
        const next = new FolderStatus();
        next.branch = s.branch;
        const marks = base === "HEAD" ? marksOf(s.entries) : await readBaseMarks(this.workspace.repo, this.workspace.folder, base, s.entries);
        const before = this.status.peek().marks;
        next.marks = sameMarks(before, marks) ? before : marks;
        next.counts = await readNumstat(this.workspace.repo, this.workspace.folder, base);
        this.status.value = next;
        this.hooks.statusLoaded.fire();
      } while (this.statusAgain);
    } finally {
      this.statusBusy = false;
    }
  }

  /** Compare changes with `base` ("HEAD" or a commit), of `kind`, named `name`; status is read again. */
  async setBase(base: string, kind: string, name: string): Promise<void> {
    this.base.value = new CompareBase(base, kind, name);
    this.hooks.baseChanged.fire();
    await this.loadStatus();
  }

  /** A batch of the folder's changes from the watcher. */
  private received(b: ChangeBatch): void {
    const fn = this.onNote;
    if (fn !== null) fn("changes " + b.paths.join(",") + (b.structure ? " +structure" : "") + (b.git ? " +git" : ""));
    this.batch = b;
    const now = Date.now();
    for (const p of b.paths) this.changeTimes.set(p, now);
    void this.reload(b.structure);
    this.hooks.folderChanged.fire();
  }

  /** Read the listing and status after a batch; a git failure is said, not an unhandled rejection. */
  private async reload(structure: boolean): Promise<void> {
    try {
      if (structure) await this.loadFiles();
      await this.loadStatus();
    } catch (err) {
      const fn = this.onNote;
      if (fn !== null) fn("cannot read the folder: " + (err instanceof Error ? err.message : String(err)));
    }
  }
}
