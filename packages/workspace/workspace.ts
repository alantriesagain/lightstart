/**
 * @file One folder's services: its files, git state and watcher. Switching folders closes one Workspace
 * and opens another.
 */
import { directoriesOf, FileList, listFiles } from "./files.ts";
import { GitRepo, GitStatus, openRepo, readStatus } from "./git.ts";
import { ChangeBatch, TreeWatch } from "./watch.ts";

export class Workspace {
  readonly folder: string;
  readonly repo: GitRepo;
  readonly watch: TreeWatch;
  /** Receives each batch of the folder's changes. */
  onChanges: ((batch: ChangeBatch) => void) | null = null;
  /** The listing `openWorkspace` made, so the first `files` does not list again. */
  private initial: FileList | null;

  constructor(folder: string, repo: GitRepo, watch: TreeWatch, initial: FileList | null = null) {
    this.folder = folder;
    this.repo = repo;
    this.watch = watch;
    this.initial = initial;
    watch.onBatch = (b: ChangeBatch) => {
      const fn = this.onChanges;
      if (fn !== null) fn(b);
    };
  }

  /** The folder's files; the watcher follows the directories of a fresh listing. */
  async files(): Promise<FileList> {
    let list = this.initial;
    this.initial = null;
    if (list === null) list = await listFiles(this.folder, this.repo.isRepo);
    this.watch.sync(directoriesOf(list.paths));
    return list;
  }

  status(): Promise<GitStatus> {
    return readStatus(this.repo, this.folder);
  }

  close(): void {
    this.onChanges = null;
    this.watch.close();
  }
}

/** Open `folder` (absolute): its repository and its watcher, which gathers changes over `batchMs`. */
export const openWorkspace = async (folder: string, batchMs: number): Promise<Workspace> => {
  const repo = await openRepo(folder);
  const list = await listFiles(folder, repo.isRepo);
  const watch = new TreeWatch(folder, batchMs);
  watch.start(directoriesOf(list.paths), repo.gitDir);
  return new Workspace(folder, repo, watch, list);
};
