/**
 * @file Probe Z: child processes the way a desktop host uses them. A long child killed from a timer
 * (its exit code and signal), a detached child released with `unref`, `execFileSync` of a missing
 * binary throwing, and git through `spawn` with a `cwd` and the caller's own timeout, answering
 * and failing. Prints only what both runtimes print alike.
 */
import { execFileSync, spawn } from "node:child_process";
import { git, onExit } from "./p-z-spawn-kill.read.ts";

const long = spawn("sleep", ["5"], { stdio: "ignore" });
onExit(long, (code, signal) => {
  console.log("killed", String(code), String(signal));
  const detached = spawn("sleep", ["0.2"], { detached: true, stdio: "ignore" });
  detached.unref();
  console.log("detached pid", typeof detached.pid === "number" && detached.pid > 0);
  try {
    execFileSync("no-such-binary-xyz", ["--version"], { stdio: "ignore" });
    console.log("missing binary: no throw");
  } catch (e) {
    console.log("missing binary throws", e instanceof Error);
  }
  console.log("echo", execFileSync("echo", ["hi"], { encoding: "utf8" }).trim());
  git(["--version"], "/", 5000, (code, stdout, timedOut) => {
    console.log("git version", String(code), stdout.startsWith("git version"), timedOut);
    git(["no-such-subcommand"], "/", 5000, (badCode, out, badTimedOut) => {
      console.log("git bad command", String(badCode), out.length, badTimedOut);
      console.log("done");
    });
  });
});
setTimeout(() => long.kill("SIGTERM"), 200);
