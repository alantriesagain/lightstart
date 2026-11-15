// node-only
/**
 * @file The project's pidfile: the record round-trips, only its owner clears it, and a stale serve
 * is replaced only when its command line is a `light serve`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearPidRecord,
  looksLikeServe,
  readPidRecord,
  replaceStaleServe,
  writePidRecord,
} from "../node/single-instance.ts";
import { done, eq, ok } from "@lightstart/test/assert.ts";

const freshProject = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "dev-serve-pid-"));
  mkdirSync(join(dir, ".light"), { recursive: true });
  return dir;
};

const pidfile = (dir: string): string => join(dir, ".light", "serve.pid");

const fakeRecord = (dir: string, pid: number): void => writeFileSync(pidfile(dir), JSON.stringify({ pid, port: 3999 }));

const spawnIdler = (...extraArgv: string[]): ChildProcess => spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", ...extraArgv], { stdio: "ignore" });

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitGone = async (pid: number): Promise<boolean> => {
  for (let i = 0; i < 30 && isAlive(pid); i++) await new Promise((settle) => setTimeout(settle, 100));
  return !isAlive(pid);
};

const main = async (): Promise<void> => {
  const dir = freshProject();
  const bystander = spawnIdler();
  const stale = spawnIdler("light", "serve");
  try {
    await writePidRecord(dir, 3456);
    const record = await readPidRecord(dir);
    eq("the record keeps this process", String(record?.pid), String(process.pid));
    eq("and its port", String(record?.port), "3456");

    fakeRecord(dir, process.pid + 1);
    await clearPidRecord(dir);
    ok("a record another process owns is left alone", existsSync(pidfile(dir)));

    await writePidRecord(dir, 3456);
    await clearPidRecord(dir);
    ok("its own record is removed", !existsSync(pidfile(dir)));

    ok("a light.js serve is a serve", looksLikeServe("node /repo/node_modules/@lightstart/cli/bin/light.js serve projects/app --port 3400"));
    ok("so is a bare light serve", looksLikeServe("light serve ."));
    ok("a light build is not", !looksLikeServe("node /repo/node_modules/@lightstart/cli/bin/light.js build"));
    ok("a lookalike is not", !looksLikeServe("node /repo/flight.js serve"));
    ok("an unrelated server is not", !looksLikeServe("python3 -m http.server 8935"));
    ok("no command line is not", !looksLikeServe(null));

    fakeRecord(dir, bystander.pid as number);
    eq("a recycled pid that is not a serve is not replaced", String(await replaceStaleServe(dir)), "null");
    ok("and is still alive", isAlive(bystander.pid as number));

    fakeRecord(dir, stale.pid as number);
    const replaced = await replaceStaleServe(dir);
    eq("a live serve for the project is replaced", String(replaced?.pid), String(stale.pid));
    ok("and terminated", await waitGone(stale.pid as number));
    done();
  } finally {
    bystander.kill("SIGKILL");
    stale.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  }
};

await main();
