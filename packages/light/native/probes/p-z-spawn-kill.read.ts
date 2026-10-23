/**
 * Probe Z's typed listeners: child process events and execFile callbacks carry parameter types
 * the compiler reads only from TypeScript syntax, so they live here.
 */
import { spawn, type ChildProcess } from "node:child_process";

export const onExit = (child: ChildProcess, done: (code: number | null, signal: string | null) => void): void => {
  child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => done(code, signal));
};

/** git through spawn: execFile has no `cwd` natively, and a timeout is the caller's own timer. */
export const git = (args: string[], cwd: string, timeoutMs: number, done: (code: number | null, stdout: string, timedOut: boolean) => void): void => {
  const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] });
  let out = "";
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);
  child.stdout!.on("data", (chunk: Buffer) => {
    out += chunk.toString("utf8");
  });
  child.on("exit", (code: number | null) => {
    clearTimeout(timer);
    done(code, out, timedOut);
  });
};
