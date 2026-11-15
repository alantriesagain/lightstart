// node-only
/**
 * @file `light serve --ephemeral` end to end: it answers without a pidfile and stops once the
 * process named by LIGHT_PARENT_PID is gone.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { done, eqn, ok } from "@light/test/assert.ts";

const repoRoot = resolve(join(process.cwd(), "..", ".."));
const cliPath = join(repoRoot, "packages", "cli", "bin", "light.js");
const fixture = join(process.cwd(), "test", "fixtures", "project");
const pidfile = join(fixture, ".light", "serve.pid");

const freePort = (): Promise<number> =>
  new Promise((settle: (port: number) => void, reject: (error: Error) => void) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => settle(port));
    });
  });

const sleep = (ms: number): Promise<void> => new Promise((settle) => setTimeout(settle, ms));

const until = async (check: () => boolean, ms = 20000): Promise<boolean> => {
  const start = Date.now();
  while (!check() && Date.now() - start < ms) await sleep(50);
  return check();
};

const exited = (child: ChildProcess): Promise<void> =>
  new Promise((settle) => {
    if (child.exitCode !== null || child.signalCode !== null) settle();
    else child.once("exit", () => settle());
  });

const main = async (): Promise<void> => {
  rmSync(join(fixture, ".light"), { recursive: true, force: true });
  const parent = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const port = await freePort();
  let child: ChildProcess | null = null;
  let output = "";
  try {
    child = spawn(process.execPath, ["--no-warnings", cliPath, "serve", fixture, "--ephemeral", "--port", String(port)], {
      cwd: repoRoot,
      env: { ...process.env, LIGHT_PARENT_PID: String(parent.pid), NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });

    ok("the ephemeral server listens", await until(() => output.includes("Dev server running at")));
    let status = 0;
    for (let i = 0; i < 100 && status === 0; i++) {
      try {
        status = (await fetch(`http://127.0.0.1:${port}/`)).status;
      } catch {
        await sleep(100);
      }
    }
    eqn("and answers with the project's page", status, 200);
    ok("an ephemeral server writes no pidfile", !existsSync(pidfile));

    parent.kill("SIGKILL");
    await exited(parent);
    ok("it stops once its parent is gone", await until(() => child?.exitCode !== null || child?.signalCode !== null, 15000));
    ok("and leaves no pidfile behind", !existsSync(pidfile));
  } finally {
    child?.kill("SIGKILL");
    parent.kill("SIGKILL");
    rmSync(join(fixture, ".light"), { recursive: true, force: true });
  }
  done();
};

await main();
