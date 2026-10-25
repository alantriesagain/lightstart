/**
 * @file What the Git tab reads, all read-only: the local branches (upstream, ahead and behind, last
 * commit), a branch's log limited to the folder, a commit's files with their lines, the branch the
 * repository treats as its main one and where HEAD left it, and the commit HEAD was on at a time.
 * Commits are named by their full hash; a merge's files are its changes against its first parent.
 *
 * Branches list the current one first, then the most recently committed. A merge's diff is against
 * its first parent, named outright: `-m --first-parent` lists a merge against each parent.
 */
import { GitRepo } from "./git.ts";
import { ProcessRun } from "@light/lib/process.ts";
import { git } from "./git.read.ts";
import { LineCount, parseNameStatus, parseNumstat } from "./git-parse.ts";
export const LOG_MAX = 200;

export class AheadBehind {
  readonly ahead: number;
  readonly behind: number;

  constructor(ahead: number, behind: number) {
    this.ahead = ahead;
    this.behind = behind;
  }
}

export class Branch {
  name = "";
  upstream = "";
  ahead = 0;
  behind = 0;
  /** The upstream is configured but gone from the remote. */
  gone = false;
  current = false;
  /** The last commit's time (epoch ms) and subject. */
  commitMs = 0;
  subject = "";
}

export class Commit {
  sha = "";
  short = "";
  /** Parent hashes; none for a root commit. */
  parents: string[] = [];
  timeMs = 0;
  author = "";
  subject = "";
}

export class CommitFile {
  /** Relative to the folder. */
  path = "";
  /** A, M, D (T and others as git says). */
  mark = "";
  added = 0;
  removed = 0;
  binary = false;
}

/** `for-each-ref` lines of NUL-separated fields: name, upstream, track, unix time, subject, HEAD mark. */
export const parseBranches = (text: string): Branch[] => {
  const out: Branch[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const f = line.split("\0");
    if (f.length < 6) continue;
    const b = new Branch();
    b.name = f[0];
    b.upstream = f[1];
    const track = f[2];
    b.gone = track === "gone";
    const ahead = /ahead (\d+)/.exec(track);
    const behind = /behind (\d+)/.exec(track);
    if (ahead !== null) b.ahead = Number(ahead[1]);
    if (behind !== null) b.behind = Number(behind[1]);
    b.commitMs = Number(f[3]) * 1000;
    b.subject = f[4];
    b.current = f[5] === "*";
    out.push(b);
  }
  out.sort((a, b) => (a.current !== b.current ? (a.current ? -1 : 1) : b.commitMs - a.commitMs));
  return out;
};

export const readBranches = async (repo: GitRepo, folder: string): Promise<Branch[]> => {
  const none: Branch[] = [];
  if (!repo.isRepo) return none;
  const run = await git(["for-each-ref", "--format=%(refname:short)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(committerdate:unix)%00%(subject)%00%(HEAD)", "refs/heads"], folder, 4 * 1024 * 1024);
  return run.ok ? parseBranches(run.text) : none;
};

/** `log` records (RS-separated) of NUL-separated fields: hash, short hash, parents, unix time, author, subject. */
export const parseLog = (text: string): Commit[] => {
  const out: Commit[] = [];
  for (const record of text.split("\u001e")) {
    const r = record.startsWith("\n") ? record.slice(1) : record;
    if (r.length === 0) continue;
    const f = r.split("\0");
    if (f.length < 6) continue;
    const c = new Commit();
    c.sha = f[0];
    c.short = f[1];
    c.parents = f[2].length > 0 ? f[2].split(" ") : [];
    c.timeMs = Number(f[3]) * 1000;
    c.author = f[4];
    c.subject = f[5];
    out.push(c);
  }
  return out;
};

/** `ref`'s newest commits that touch the folder ([] for an unknown ref or no commit). */
export const readLog = async (repo: GitRepo, folder: string, ref: string, max: number): Promise<Commit[]> => {
  const none: Commit[] = [];
  if (!repo.isRepo) return none;
  const run = await git(["log", "--format=%H%x00%h%x00%P%x00%ct%x00%an%x00%s%x1e", "-n", String(max), ref, "--", "."], folder, 8 * 1024 * 1024);
  return run.ok ? parseLog(run.text) : none;
};

/** The files `commit` changed in the folder (against its first parent; everything for a root commit). */
export const readCommitFiles = async (repo: GitRepo, folder: string, commit: Commit): Promise<CommitFile[]> => {
  const out: CommitFile[] = [];
  if (!repo.isRepo) return out;
  const trees = commit.parents.length > 0 ? [commit.parents[0], commit.sha] : ["--root", commit.sha];
  const args = ["diff-tree", "-r", "--no-commit-id", "--no-renames", "--relative", "-z"];
  const status = await git(args.concat(["--name-status"], trees, ["--", "."]), folder, 8 * 1024 * 1024);
  const numstat = await git(args.concat(["--numstat"], trees, ["--", "."]), folder, 8 * 1024 * 1024);
  if (!status.ok) return out;
  const marks = parseNameStatus(status.text);
  const counts = numstat.ok ? parseNumstat(numstat.text) : new Map<string, LineCount>();
  for (const path of marks.keys()) {
    const f = new CommitFile();
    f.path = path;
    f.mark = marks.get(path) ?? "M";
    const c = counts.get(path);
    if (c !== undefined) {
      f.added = c.added;
      f.removed = c.removed;
      f.binary = c.binary;
    }
    out.push(f);
  }
  return out;
};

const firstLine = (run: ProcessRun): string => (run.ok ? run.text.split("\n")[0].trim() : "");

/** The repository's main branch: origin's HEAD, else main, else master; "" when none exists. */
export const readDefaultBranch = async (repo: GitRepo, folder: string): Promise<string> => {
  if (!repo.isRepo) return "";
  const origin = firstLine(await git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], folder, 4096));
  if (origin.length > 0) return origin;
  for (const name of ["main", "master"]) if (firstLine(await git(["rev-parse", "--verify", "--quiet", "refs/heads/" + name], folder, 4096)).length > 0) return name;
  return "";
};

/** The commit where HEAD and `ref` part ("" when they share none). */
export const readMergeBase = async (repo: GitRepo, folder: string, ref: string): Promise<string> => (repo.isRepo ? firstLine(await git(["merge-base", "HEAD", ref], folder, 4096)) : "");

/** How many commits `a` has that `b` lacks (ahead) and the reverse (behind); -1 and -1 when either is unknown. */
export const readAheadBehind = async (repo: GitRepo, folder: string, a: string, b: string): Promise<AheadBehind> => {
  if (!repo.isRepo) return new AheadBehind(-1, -1);
  const line = firstLine(await git(["rev-list", "--left-right", "--count", a + "..." + b], folder, 4096));
  const parts = line.split(/\s+/);
  if (parts.length < 2) return new AheadBehind(-1, -1);
  const ahead = Number(parts[0]);
  const behind = Number(parts[1]);
  return Number.isInteger(ahead) && Number.isInteger(behind) ? new AheadBehind(ahead, behind) : new AheadBehind(-1, -1);
};

/** A branch of a remote (`mac/main`): its tip, and how it stands to the local branch of the same name when there is one. */
export class RemoteBranch {
  /** The branch's name without the remote ("main"). */
  readonly name: string;
  /** The ref as git names it ("mac/main"). */
  readonly ref: string;
  readonly sha: string;
  readonly commitMs: number;
  /** Whether a local branch of the same name exists. */
  readonly local: boolean;
  /** Commits the local branch has that the remote's lacks, and the reverse (-1 without a local branch). */
  readonly ahead: number;
  readonly behind: number;

  constructor(name: string, ref: string, sha: string, commitMs: number, local: boolean, ahead: number, behind: number) {
    this.name = name;
    this.ref = ref;
    this.sha = sha;
    this.commitMs = commitMs;
    this.local = local;
    this.ahead = ahead;
    this.behind = behind;
  }
}

/** The branches of `remote` as fetched here, each against the local branch of its name (`HEAD` of the remote left out). */
export const readRemoteBranches = async (repo: GitRepo, folder: string, remote: string): Promise<RemoteBranch[]> => {
  const out: RemoteBranch[] = [];
  if (!repo.isRepo || remote.length === 0) return out;
  const text = (await git(["for-each-ref", "--format=%(refname:short)%09%(objectname)%09%(committerdate:unix)", "refs/remotes/" + remote + "/"], folder, 1048576)).text;
  const locals = new Set<string>();
  for (const line of (await git(["for-each-ref", "--format=%(refname:short)", "refs/heads/"], folder, 1048576)).text.split("\n")) if (line.trim().length > 0) locals.add(line.trim());
  for (const line of text.split("\n")) {
    const f = line.split("\t");
    if (f.length < 3 || !f[0].startsWith(remote + "/")) continue;
    const name = f[0].slice(remote.length + 1);
    if (name === "HEAD") continue;
    const local = locals.has(name);
    const track = local ? await readAheadBehind(repo, folder, "refs/heads/" + name, "refs/remotes/" + f[0]) : new AheadBehind(-1, -1);
    const ms = Number(f[2]);
    out.push(new RemoteBranch(name, f[0], f[1], Number.isInteger(ms) ? ms * 1000 : 0, local, track.ahead, track.behind));
  }
  return out;
};

/** The repository's oldest root commit ("" without one): what the same repository is called on another machine. */
export const readRootCommit = async (repo: GitRepo, folder: string): Promise<string> => {
  if (!repo.isRepo) return "";
  const lines = (await git(["rev-list", "--max-parents=0", "HEAD"], folder, 65536)).text.split("\n").filter((l: string) => l.trim().length > 0);
  return lines.length > 0 ? lines[lines.length - 1].trim() : "";
};

/** HEAD's commit now ("" without one). */
export const readHeadCommit = async (repo: GitRepo, folder: string): Promise<string> => (repo.isRepo ? firstLine(await git(["rev-parse", "--verify", "--quiet", "HEAD"], folder, 4096)) : "");

/** The commit HEAD's history was at by `epochMs` ("" for none that old). */
export const readCommitAt = async (repo: GitRepo, folder: string, epochMs: number): Promise<string> =>
  repo.isRepo ? firstLine(await git(["rev-list", "-1", "--before=" + String(Math.floor(epochMs / 1000)), "HEAD"], folder, 4096)) : "";
