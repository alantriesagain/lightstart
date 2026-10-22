/**
 * @file A long-running process a plugin started (api.process.spawn), an agent's CLI above all: its
 * output reaches the plugin as lines, in batches (a sixtieth of a second's worth, so a stream of
 * many small messages is one call), its input takes the lines the plugin writes, and it ends when
 * the plugin stops or kills it, or when the plugins load again. It starts without Claude Code's
 * own variables (CLAUDECODE, CLAUDE_CODE_ENTRYPOINT), so a plugin run from inside Claude Code
 * starts its tools as a fresh shell would.
 *
 * Its input closing early (it exited) is reported by the exit, not as an error.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { errorMessage } from "@light/lib/json.ts";
import { LineSplitter } from "@light/lib/ndjson.ts";

const BATCH_MS = 16;
/** Lines held for the next batch; past it the oldest are dropped and the plugin is told. */
const PENDING_MAX = 2048;

export class PluginProcess {
  /** Its handle in the plugin, and the plugin that started it. */
  readonly id: number;
  readonly owner: string;
  /** Called with a batch of output lines, with the exit code (-1 when it did not start or was killed), with what it wrote to stderr. */
  onLines: ((lines: string[]) => void) | null = null;
  onExit: ((code: number) => void) | null = null;
  onError: ((text: string) => void) | null = null;
  private child: ChildProcess | null = null;
  private readonly splitter = new LineSplitter();
  private pending: string[] = [];
  private flushQueued = false;
  private ended = false;
  private dropped = false;

  constructor(id: number, owner: string) {
    this.id = id;
    this.owner = owner;
  }

  /** Whether it runs. */
  get alive(): boolean {
    return this.child !== null && !this.ended;
  }

  /** Start `command` (its program, then its arguments) in `cwd`; "" or why it could not. */
  start(command: string[], cwd: string): string {
    if (command.length === 0) return "no command";
    let child: ChildProcess;
    try {
      const args = ["-u", "CLAUDECODE", "-u", "CLAUDE_CODE_ENTRYPOINT"].concat(command);
      child = cwd.length > 0 ? spawn("env", args, { cwd, stdio: ["pipe", "pipe", "pipe"] }) : spawn("env", args, { stdio: ["pipe", "pipe", "pipe"] });
    } catch (err) {
      return errorMessage(err, "cannot start ") + command[0];
    }
    this.child = child;
    child.stdout!.on("data", (chunk: Buffer) => {
      for (const line of this.splitter.push(chunk)) this.queue(line);
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      const fn = this.onError;
      if (fn !== null) fn(chunk.toString("utf8"));
    });
    child.on("error", (err: Error) => {
      const fn = this.onError;
      if (fn !== null) fn(err.message);
      this.finish(-1);
    });
    child.on("exit", (code: number | null) => this.finish(code === null ? -1 : code));
    child.stdin!.on("error", (_e: Error) => {});
    return "";
  }

  /** The process is over: its last lines, then one exit, once. */
  private finish(code: number): void {
    if (this.ended) return;
    for (const line of this.splitter.flush()) this.queue(line);
    this.flush();
    this.ended = true;
    const fn = this.onExit;
    if (fn !== null) fn(code);
  }

  private queue(line: string): void {
    if (this.ended) return;
    if (this.pending.length >= PENDING_MAX) {
      if (!this.dropped) {
        this.dropped = true;
        const fn = this.onError;
        if (fn !== null) fn("plugins: " + String(PENDING_MAX) + " lines waiting; output dropped");
      }
      return;
    }
    this.pending.push(line);
    if (this.flushQueued) return;
    this.flushQueued = true;
    setTimeout(() => this.flush(), BATCH_MS).unref();
  }

  private flush(): void {
    this.flushQueued = false;
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    const fn = this.onLines;
    if (fn !== null) fn(batch);
  }

  /** Write `line` and a newline to its input. */
  write(line: string): void {
    const child = this.child;
    if (child !== null && !this.ended) child.stdin!.write(line + "\n");
  }

  /** Close its input, killing it if it has not ended after `graceMs`. */
  stop(graceMs: number): void {
    const child = this.child;
    if (child === null || this.ended) return;
    child.stdin!.end();
    setTimeout(() => {
      if (!this.ended) child.kill("SIGKILL");
    }, Math.max(0, graceMs)).unref();
  }

  kill(): void {
    const child = this.child;
    if (child !== null && !this.ended) child.kill("SIGKILL");
  }
}
