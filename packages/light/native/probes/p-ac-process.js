/**
 * @file Probe AC: the process surface a host needs. argv, env, platform, execPath, pid, cwd, the
 * home and temp directories, an exit listener, and a SIGTERM handler reached by signalling itself.
 */
import { homedir, tmpdir } from "node:os";

console.log("argv", process.argv.length >= 1, "env", typeof process.env.HOME, "platform", process.platform);
console.log("exec", typeof process.execPath === "string" && process.execPath.length > 0, "pid", process.pid > 0, "cwd", process.cwd().length > 0);
console.log("home", homedir() === process.env.HOME, "tmp", tmpdir().length > 0);
process.on("exit", () => {
  console.log("exit listener ran");
});
process.on("SIGTERM", () => {
  console.log("sigterm received");
  process.exit(0);
});
setTimeout(() => {
  process.kill(process.pid, "SIGTERM");
}, 50);
setTimeout(() => {
  console.log("signal never arrived");
  process.exit(1);
}, 2000);
