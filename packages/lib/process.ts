/**
 * @file A child process run to its end, adapted from bootstrapp's desktop shell: its output gathered
 * as Buffers and decoded once (a multi-byte character can straddle two chunks), nothing trimmed
 * (a file's content from `git show` keeps its last newline), output past `maxBytes` dropped and
 * the run marked truncated, a run past `timeoutMs` killed and answered at once with what it
 * wrote. The promise always resolves: a run that could not start says so in `error`.
 *
 * A child that ignores the first signal is killed after a grace period. A command that does not
 * read its input may exit before the write lands, so a broken pipe on its input is ignored.
 */
import { type ChildProcess, spawn } from "node:child_process";

export class SpawnOptions {
  /** The working directory ("" for the process's own). */
  cwd = "";
  /** What the child reads on its stdin, closed after it; null leaves stdin unopened. */
  input: string | null = null;
  timeoutMs = 15000;
  maxBytes = 16 * 1024 * 1024;
  /** The signal a run past its time gets. */
  killSignal: "SIGTERM" | "SIGKILL" = "SIGTERM";
}

export class ProcessRun {
  code = 0;
  out: Buffer = Buffer.alloc(0);
  errOut: Buffer = Buffer.alloc(0);
  /** Output past `maxBytes` was dropped. */
  truncated = false;
  /** Killed past `timeoutMs` (the code is -1). */
  timedOut = false;
  /** Why it could not start or run ("" when it ran to its end or its time). */
  error = "";

  get ok(): boolean {
    return this.code === 0 && this.error.length === 0;
  }

  /** What it wrote on stdout. */
  get text(): string {
    return this.out.toString("utf8");
  }

  /** What it wrote on stderr, trimmed. */
  get err(): string {
    return this.errOut.toString("utf8").trim();
  }
}

const start = (command: string, args: string[], o: SpawnOptions): ChildProcess => {
  if (o.input === null) return o.cwd.length > 0 ? spawn(command, args, { cwd: o.cwd, stdio: ["ignore", "pipe", "pipe"] }) : spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  return o.cwd.length > 0 ? spawn(command, args, { cwd: o.cwd, stdio: ["pipe", "pipe", "pipe"] }) : spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
};

/** Run `command` with `args` to its end (or its time), its output capped. */
export const spawnCapped = (command: string, args: string[], o: SpawnOptions): Promise<ProcessRun> =>
  new Promise((resolvePromise) => {
    const run = new ProcessRun();
    let child: ChildProcess;
    try {
      child = start(command, args, o);
    } catch {
      run.code = -1;
      run.error = "cannot start " + command;
      resolvePromise(run);
      return;
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let size = 0;
    let errSize = 0;
    let settled = false;
    const finish = (code: number, error: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run.code = code;
      run.error = error;
      run.out = Buffer.concat(out);
      run.errOut = Buffer.concat(err);
      resolvePromise(run);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      run.timedOut = true;
      child.kill(o.killSignal);
      if (o.killSignal !== "SIGKILL") {
        const hard = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
          }
        }, 1000);
        hard.unref();
      }
      finish(-1, "");
    }, o.timeoutMs);
    child.stdout!.on("data", (chunk: Buffer) => {
      if (settled) return;
      if (size >= o.maxBytes) {
        run.truncated = true;
        return;
      }
      const room = o.maxBytes - size;
      if (chunk.length > room) {
        out.push(chunk.subarray(0, room));
        size = o.maxBytes;
        run.truncated = true;
      } else {
        out.push(chunk);
        size += chunk.length;
      }
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      if (settled) return;
      if (errSize >= o.maxBytes) {
        run.truncated = true;
        return;
      }
      const room = o.maxBytes - errSize;
      if (chunk.length > room) {
        err.push(chunk.subarray(0, room));
        errSize = o.maxBytes;
        run.truncated = true;
      } else {
        err.push(chunk);
        errSize += chunk.length;
      }
    });
    child.on("error", (e: Error) => {
      finish(-1, e.message);
    });
    child.on("close", (code: number | null) => {
      finish(code === null ? -1 : code, "");
    });
    if (o.input !== null) {
      child.stdin!.on("error", (_e: Error) => {});
      child.stdin!.write(o.input);
      child.stdin!.end();
    }
  });
