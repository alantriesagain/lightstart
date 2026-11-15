/**
 * @file One dev server per project: `light serve` records itself in `<project>/.light/serve.pid`,
 * the next serve for the same project stops a stale one first, and an ephemeral server watches
 * the parent that spawned it instead of taking a pidfile.
 */
import { promises as fs, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/** What a pidfile holds: the server's process and the port it listens on. */
export type ServePidRecord = { pid: number; port: number };

const pidfilePath = (projectDir: string): string => join(projectDir, ".light", "serve.pid");

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const commandLine = (pid: number): string | null => {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, "utf-8").replaceAll("\0", " ");
  } catch {}
  try {
    return execFileSync("ps", ["-o", "args=", "-p", String(pid)], { encoding: "utf-8" });
  } catch {
    return null;
  }
};

/** A pid qualifies for takeover only when its command line is a `light serve`. */
export const looksLikeServe = (cmdline: string | null): boolean => {
  const tokens = cmdline?.split(/\s+/) ?? [];
  return tokens.includes("serve") && tokens.some((token) => /(^|\/)light(\.js)?$/.test(token));
};

/** The record a project's pidfile holds, or null when it is missing or unreadable. */
export const readPidRecord = async (projectDir: string): Promise<ServePidRecord | null> => {
  try {
    const record = JSON.parse(await fs.readFile(pidfilePath(projectDir), "utf-8")) as ServePidRecord;
    return Number.isInteger(record.pid) ? record : null;
  } catch {
    return null;
  }
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Sends `signal` and polls up to `tries` times, a tenth of a second apart; true once the process is gone. */
const signalAndWait = async (pid: number, signal: NodeJS.Signals, tries: number): Promise<boolean> => {
  try {
    process.kill(pid, signal);
  } catch {}
  for (let i = 0; i < tries && alive(pid); i++) await wait(100);
  return !alive(pid);
};

/**
 * Terminate the previous serve recorded for this project, freeing its port. Refuses to touch a
 * recycled pid whose command line is not a light serve. Answers the replaced record, or null
 * when there was nothing to replace.
 */
export const replaceStaleServe = async (projectDir: string): Promise<ServePidRecord | null> => {
  const record = await readPidRecord(projectDir);
  if (!record || record.pid === process.pid || !alive(record.pid) || !looksLikeServe(commandLine(record.pid))) return null;
  if (!(await signalAndWait(record.pid, "SIGTERM", 20))) await signalAndWait(record.pid, "SIGKILL", 5);
  return record;
};

/** Record this process and its port as the project's serve. */
export const writePidRecord = async (projectDir: string, port: number): Promise<void> => {
  await fs.mkdir(join(projectDir, ".light"), { recursive: true });
  await fs.writeFile(pidfilePath(projectDir), JSON.stringify({ pid: process.pid, port } satisfies ServePidRecord));
};

/** Remove the pidfile only when this process owns it. */
export const clearPidRecord = async (projectDir: string): Promise<void> => {
  const record = await readPidRecord(projectDir);
  if (record?.pid === process.pid) await fs.unlink(pidfilePath(projectDir)).catch(() => {});
};

/** Poll the spawning parent and run `onGone` when it is gone; the interval does not keep node alive. */
export const watchParent = (parentPid: number, onGone: () => void = () => process.exit(0)): void => {
  setInterval(() => {
    if (!alive(parentPid)) onGone();
  }, 3000).unref();
};
