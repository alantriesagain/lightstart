/**
 * @file git as the core reads it: every read runs through `git`, with --no-optional-locks so reading
 * status never rewrites the index (whose change the watcher would report, which would read status
 * again) and paths printed as they are. A run that cannot start or outlives its time rejects.
 */
import { ProcessRun, spawnCapped, SpawnOptions } from "@light/lib/process.ts";

const READ_FLAGS = ["--no-optional-locks", "-c", "core.quotepath=off"];
const READ_TIMEOUT_MS = 15000;

const runGit = async (args: string[], cwd: string, timeoutMs: number, maxBytes: number): Promise<ProcessRun> => {
  const o = new SpawnOptions();
  o.cwd = cwd;
  o.timeoutMs = timeoutMs;
  o.maxBytes = maxBytes;
  const run = await spawnCapped("git", args, o);
  if (run.timedOut) throw new Error("git " + args.join(" ") + " timed out");
  if (run.error.length > 0) throw new Error(run.error);
  return run;
};

/** Run git with the read flags before `args`, its output capped at `maxBytes` (marked truncated past it); a run past `timeoutMs` (15 s unless said) rejects. */
export const git = (args: string[], cwd: string, maxBytes: number, timeoutMs = READ_TIMEOUT_MS): Promise<ProcessRun> => {
  const all = READ_FLAGS.slice();
  for (const a of args) all.push(a);
  return runGit(all, cwd, timeoutMs, maxBytes);
};
