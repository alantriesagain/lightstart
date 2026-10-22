/**
 * @file The folder's git state: whether it is in a work tree, the branch, `status` for the folder
 * (porcelain v1, NUL-separated: a rename carries its old path as the next field) and a file's
 * content at HEAD. Paths are relative to the folder, which may be below the repository's root.
 *
 * Status reads the branch and the entries in one run; with -z the branch header ends at NUL.
 */
import { ProcessRun } from "@light/lib/process.ts";
import { git } from "./git.read.ts";

export class GitRepo {
  isRepo = false;
  /** The work tree's root, absolute. */
  root = "";
  /** The folder's path below the root, with a trailing slash ("" at the root). */
  prefix = "";
  /** The repository's git directory, absolute (watched for index and HEAD changes). */
  gitDir = "";
}

export class GitEntry {
  /** Relative to the folder; a path outside it (a rename's source) keeps its root-relative form. */
  path: string;
  /** Index and work-tree status letters, as `git status --short` prints them ("?" for untracked). */
  x: string;
  y: string;
  /** A rename's or copy's source, else "". */
  orig: string;

  constructor(path: string, x: string, y: string, orig: string) {
    this.path = path;
    this.x = x;
    this.y = y;
    this.orig = orig;
  }
}

export class GitStatus {
  branch = "";
  entries: GitEntry[] = [];
  truncated = false;
}

/** A file at HEAD: absent when it is not in HEAD (new, or no commit yet). */
export class HeadFile {
  exists = false;
  text = "";
  binary = false;
  truncated = false;
}

export const isBinary = (buf: Buffer): boolean => {
  const n = buf.length < 8192 ? buf.length : 8192;
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
};

export const openRepo = async (folder: string): Promise<GitRepo> => {
  const repo = new GitRepo();
  let run: ProcessRun;
  try {
    run = await git(["rev-parse", "--show-toplevel", "--absolute-git-dir", "--show-prefix"], folder, 4096);
  } catch {
    return repo;
  }
  if (!run.ok) return repo;
  const lines = run.text.split("\n");
  if (lines.length < 3) return repo;
  repo.isRepo = true;
  repo.root = lines[0];
  repo.gitDir = lines[1];
  repo.prefix = lines[2];
  return repo;
};

/** Parse `status --porcelain=v1 -z` output; entries outside `prefix` are left out. */
export const parseStatus = (text: string, prefix: string): GitEntry[] => {
  const out: GitEntry[] = [];
  const fields = text.split("\0");
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    i++;
    if (f.length < 4) continue;
    const x = f.charAt(0);
    const y = f.charAt(1);
    const path = f.slice(3);
    let orig = "";
    if (x === "R" || x === "C" || y === "R" || y === "C") {
      orig = i < fields.length ? fields[i] : "";
      i++;
    }
    if (!path.startsWith(prefix)) continue;
    const rel = path.slice(prefix.length);
    const origRel = orig.startsWith(prefix) ? orig.slice(prefix.length) : orig;
    out.push(new GitEntry(rel, x, y, origRel));
  }
  return out;
};

export const readStatus = async (repo: GitRepo, folder: string): Promise<GitStatus> => {
  const status = new GitStatus();
  if (!repo.isRepo) return status;
  const run = await git(["status", "--porcelain=v1", "-b", "-z", "--untracked-files=all", "--", "."], folder, 32 * 1024 * 1024);
  if (!run.ok) throw new Error("git status: " + run.err);
  let body = run.text;
  if (body.startsWith("## ")) {
    const end = body.indexOf("\0");
    if (end >= 0) {
      let head = body.slice(3, end);
      body = body.slice(end + 1);
      const dots = head.indexOf("...");
      if (dots >= 0) head = head.slice(0, dots);
      if (head.startsWith("No commits yet on ")) head = head.slice("No commits yet on ".length);
      head = head.trim();
      if (head !== "HEAD (no branch)" && head.length > 0) status.branch = head;
    }
  }
  if (status.branch.length === 0) {
    const head = await git(["rev-parse", "--short", "HEAD"], folder, 4096);
    if (head.ok) status.branch = head.text.trim();
  }
  status.entries = parseStatus(body, repo.prefix);
  status.truncated = run.truncated;
  return status;
};

export const readHead = async (repo: GitRepo, folder: string, path: string, maxBytes: number): Promise<HeadFile> => {
  const file = new HeadFile();
  if (!repo.isRepo) return file;
  const run = await git(["show", "HEAD:./" + path], folder, maxBytes);
  if (!run.ok) return file;
  file.exists = true;
  file.truncated = run.truncated;
  if (isBinary(run.out)) file.binary = true;
  else file.text = run.text;
  return file;
};
