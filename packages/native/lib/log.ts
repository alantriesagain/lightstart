/**
 * @file Diagnostics never touch stdout while the alt screen is active: they go to a file, given by
 * `--log <path>` or made per run in a folder (`openLogIn`, the older ones pruned). A path that
 * cannot be written turns the log off, saying so once on stderr, so diagnostics never take the app
 * down; a log past its cap stops. The trail keeps what ran last, cheaply, for a crash to name:
 * natively an error carries no stack frames.
 */
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

/** How much one log file takes before it stops. */
export const LOG_MAX_BYTES = 64 * 1024 * 1024;

let path: string | null = null;
let written = 0;
let cap = LOG_MAX_BYTES;
let name = "log";
const t0 = Date.now();

/** The name the log's own warnings on stderr start with: the app's, set at start. */
export function nameLog(app: string): void {
  name = app;
}

/** Say on stderr why the log is off (stdout is the screen). */
const warn = (text: string): void => {
  try {
    process.stderr.write(name + ": " + text + "\n");
  } catch {
  }
};

/** Log to file `p` from now on (null: off), at most `maxBytes` of it. */
export function openLog(p: string | null, maxBytes: number = LOG_MAX_BYTES): void {
  path = null;
  written = 0;
  cap = maxBytes;
  if (p === null) return;
  try {
    appendFileSync(p, "--- log opened " + new Date().toISOString() + "\n");
    path = p;
  } catch (err) {
    warn("cannot log to " + p + ": " + (err instanceof Error ? err.message : String(err)));
  }
}

/** The file the log goes to, "" when it is off. */
export function logPath(): string {
  return path ?? "";
}

const two = (n: number): string => String(n).padStart(2, "0");

/** A local time as a file name's start that sorts by time: 2026-10-21T14-03-22. */
const stamp = (d: Date): string => String(d.getFullYear()) + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + "T" + two(d.getHours()) + "-" + two(d.getMinutes()) + "-" + two(d.getSeconds());

/**
 * Log to a file of this run's own in folder `dir` (made when missing), named by the time and the
 * process id, the oldest `.log` files there removed so that `keep` remain with this one. Answers
 * the file's path, "" when it could not be opened.
 */
export function openLogIn(dir: string, keep: number, maxBytes: number = LOG_MAX_BYTES): string {
  try {
    mkdirSync(dir, { recursive: true });
    const old = readdirSync(dir).filter((n) => n.endsWith(".log"));
    old.sort();
    for (let i = 0; i < old.length - Math.max(0, keep - 1); i++) rmSync(join(dir, old[i]), { force: true });
  } catch (err) {
    openLog(null);
    warn("cannot log in " + dir + ": " + (err instanceof Error ? err.message : String(err)));
    return "";
  }
  const p = join(dir, stamp(new Date()) + "-" + String(process.pid) + ".log");
  openLog(p, maxBytes);
  return logPath();
}

export function log(msg: string): void {
  const p = path;
  if (p === null) return;
  const line = String(Date.now() - t0).padStart(7, " ") + " " + msg + "\n";
  try {
    if (written + line.length > cap) {
      appendFileSync(p, "the log reached its cap (" + String(Math.round(cap / 1024 / 1024)) + " MB); nothing more is written\n");
      path = null;
      return;
    }
    appendFileSync(p, line);
    written += line.length;
  } catch (err) {
    path = null;
    warn("cannot write " + p + ": " + (err instanceof Error ? err.message : String(err)) + "; the log is off");
  }
}

/** How many of the latest top-level happenings the trail keeps. */
const TRAIL_SIZE = 96;
/** How deep the open entries are kept (a runaway recursion goes deeper than this). */
const TRAIL_DEPTH = 32;

/**
 * What ran last, for a crash to name. An entry is a kind ("key", "plugin", "frame") and what it is
 * about (a key, a plugin's id). Entered, it is open until left: a crash finds open the entries it
 * happened in, innermost last. Entered with nothing open, it is also kept among the latest, the
 * same one again counted rather than kept twice. Costs no allocation of its own.
 */
export class Trail {
  /** Frames begun (`frame`). */
  frames = 0;
  private kinds: string[] = [];
  private names: string[] = [];
  private counts: number[] = [];
  private times: number[] = [];
  private next = 0;
  private size = 0;
  private openKinds: string[] = [];
  private openNames: string[] = [];
  private depth = 0;

  constructor() {
    for (let i = 0; i < TRAIL_SIZE; i++) {
      this.kinds.push("");
      this.names.push("");
      this.counts.push(0);
      this.times.push(0);
    }
    for (let i = 0; i < TRAIL_DEPTH; i++) {
      this.openKinds.push("");
      this.openNames.push("");
    }
  }

  /** `kind` about `name` starts; answers the depth `leave` goes back to. With nothing open it is kept among the latest. */
  enter(kind: string, name: string): number {
    const d = this.depth;
    this.push(kind, name);
    if (d === 0) this.record(kind, name);
    return d;
  }

  /** `kind` about `name` starts, open only (a frame's phases, which run too often to be kept among the latest). */
  within(kind: string, name: string): number {
    const d = this.depth;
    this.push(kind, name);
    return d;
  }

  /** What `enter` or `within` started ended: back to its depth (an exception caught between them is forgotten here). */
  leave(depth: number): void {
    this.depth = depth;
  }

  /** Nothing is open: a top-level boundary (a key, a frame) that heals a depth an exception left. */
  reset(): void {
    this.depth = 0;
  }

  private push(kind: string, name: string): void {
    const d = this.depth;
    if (d < TRAIL_DEPTH) {
      this.openKinds[d] = kind;
      this.openNames[d] = name;
    }
    this.depth = d + 1;
  }

  private record(kind: string, name: string): void {
    const now = Date.now();
    if (this.size > 0) {
      const last = (this.next + TRAIL_SIZE - 1) % TRAIL_SIZE;
      if (this.kinds[last] === kind && this.names[last] === name) {
        this.counts[last]++;
        this.times[last] = now;
        return;
      }
    }
    this.kinds[this.next] = kind;
    this.names[this.next] = name;
    this.counts[this.next] = 1;
    this.times[this.next] = now;
    this.next = (this.next + 1) % TRAIL_SIZE;
    if (this.size < TRAIL_SIZE) this.size++;
  }

  /** What is open, outermost first ("" for nothing). */
  open(): string {
    const parts: string[] = [];
    for (let i = 0; i < Math.min(this.depth, TRAIL_DEPTH); i++) parts.push(this.openKinds[i] + " " + this.openNames[i]);
    if (this.depth > TRAIL_DEPTH) parts.push("… " + String(this.depth - TRAIL_DEPTH) + " more");
    return parts.join(" > ");
  }

  /** The trail as text: what is open, the frames begun, then the latest happenings, oldest first, each at its time in the log (ms from its start) with how many ran in a row. */
  text(): string {
    const lines: string[] = ["open: " + (this.depth > 0 ? this.open() : "nothing"), "frames: " + String(this.frames)];
    for (let k = 0; k < this.size; k++) {
      const i = (this.next - this.size + k + TRAIL_SIZE) % TRAIL_SIZE;
      lines.push(String(this.times[i] - t0).padStart(7, " ") + " " + this.kinds[i] + " " + this.names[i] + (this.counts[i] > 1 ? " ×" + String(this.counts[i]) : ""));
    }
    return lines.join("\n");
  }
}

/** The process's trail. */
export const trail = new Trail();

/** The value after `--name` in argv, or null. */
export function argValue(name: string): string | null {
  const a = process.argv;
  for (let i = 2; i < a.length - 1; i++) if (a[i] === name) return a[i + 1];
  return null;
}

export function hasArg(name: string): boolean {
  return process.argv.indexOf(name) >= 2;
}
