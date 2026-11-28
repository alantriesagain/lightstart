/**
 * @file The undo stack over `files`: `snapshot(paths, label, fn)` records what
 * the paths held before `fn` and what they hold after it, and `undo` and
 * `redo` write those contents back. A step restores exactly what it recorded,
 * even when the files changed outside the stack since it was taken.
 */

import { signal } from "@lightstart/light/signals";
import type { Signal } from "@lightstart/light/signals";
import { files } from "./files.ts";

interface Snapshot {
  path: string;
  content: string | Blob | null;
}

interface Step {
  label: string;
  before: Snapshot[];
  after: Snapshot[];
}

const past: Step[] = [];
const future: Step[] = [];

/** Whether there is a step to undo. */
export const canUndo: Signal<boolean> = signal(false);

/** Whether there is a step to redo. */
export const canRedo: Signal<boolean> = signal(false);

const publish = (): void => {
  canUndo.value = past.length > 0;
  canRedo.value = future.length > 0;
};

const capture = async (paths: readonly string[]): Promise<Snapshot[]> => {
  const out: Snapshot[] = [];
  for (const path of paths) out.push({ path, content: await files.readBlob(path) });
  return out;
};

const restore = async (snapshots: readonly Snapshot[]): Promise<void> => {
  for (const snapshot of snapshots) {
    if (snapshot.content === null) await files.delete(snapshot.path);
    else await files.write(snapshot.path, snapshot.content);
  }
};

/**
 * Run `fn` with the paths' contents recorded before and after it, as one undo step named `label`.
 * A failed `fn` records no step.
 */
export const snapshot = async <Result>(paths: readonly string[], label: string, fn: () => Result | Promise<Result>): Promise<Result> => {
  const before = await capture(paths);
  const result = await fn();
  const after = await capture(paths);
  past.push({ label, before, after });
  future.length = 0;
  publish();
  return result;
};

/** Write the last step's recorded contents back; answers false when there is nothing to undo. */
export const undo = async (): Promise<boolean> => {
  const step = past.pop();
  if (step === undefined) return false;
  await restore(step.before);
  future.push(step);
  publish();
  return true;
};

/** Write back the contents the last undone step left; answers false when there is nothing to redo. */
export const redo = async (): Promise<boolean> => {
  const step = future.pop();
  if (step === undefined) return false;
  await restore(step.after);
  past.push(step);
  publish();
  return true;
};

/** The undo steps' labels, oldest first. */
export const labels = (): string[] => past.map((step) => step.label);

/** Forget every step, for a test or a new session. */
export const clearHistory = (): void => {
  past.length = 0;
  future.length = 0;
  publish();
};

/** The undo stack over `files`. */
export const history = { snapshot, undo, redo, canUndo, canRedo, labels, clear: clearHistory };
