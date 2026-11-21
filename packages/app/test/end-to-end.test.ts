// node-only
/**
 * @file The fixture app end to end: `light app` generates it, `light build`
 * bundles it, and `light serve` answers `/` and the generated `.light/main.ts`.
 */

import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eqn, ok } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/web", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));
const env = { ...process.env, LIGHT_PROJECT_DIR: fixture, NO_COLOR: "1" };

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

const fetchUntil = async (url: string): Promise<Response> => {
  let last: unknown = null;
  for (let i = 0; i < 100; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      last = error;
      await sleep(100);
    }
  }
  throw last instanceof Error ? last : new Error("no response from " + url);
};

const main = async (): Promise<void> => {
  rmSync(join(fixture, ".light"), { recursive: true, force: true });
  rmSync(join(fixture, ".deployed"), { recursive: true, force: true });

  const generated = spawnSync(process.execPath, ["--no-warnings", cli, "app"], { cwd: fixture, env, encoding: "utf8" });
  eqn("light app exits 0", generated.status ?? 1, 0);
  ok("light app prints what it found", (generated.stdout ?? "").includes("1 models, 2 controllers, 6 views, routes"));

  const built = spawnSync(process.execPath, ["--no-warnings", cli, "build"], { cwd: fixture, env, encoding: "utf8" });
  eqn("light build exits 0", built.status ?? 1, 0);
  ok("light build writes a build", existsSync(join(fixture, ".deployed", "current", "index.html")));

  const browser = spawnSync(process.execPath, ["--no-warnings", cli, "test", "test/app.browser.test.ts", "test/app-form.browser.test.ts"], { cwd: fixture, env, encoding: "utf8" });
  eqn("light test runs the fixture's browser test", browser.status ?? 1, 0);
  if ((browser.status ?? 1) !== 0) console.log(browser.stdout, browser.stderr);

  const port = await freePort();
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, ["--no-warnings", cli, "serve", "--port", String(port), "--ephemeral"], { cwd: fixture, env });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });

  try {
    const origin = `http://127.0.0.1:${String(port)}`;
    const page = await fetchUntil(`${origin}/`);
    eqn("light serve answers /", page.status, 200);
    ok("the page carries the app's root", (await page.text()).includes("<app-root>"));
    const mainModule = await fetchUntil(`${origin}/.light/main.ts`);
    eqn("light serve answers the generated .light/main.ts", mainModule.status, 200);
    ok("with the host's start", (await mainModule.text()).includes("@lightstart/app/web"));
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((settle) => {
      child.once("close", () => settle());
      setTimeout(settle, 3000);
    });
    if (process.env["LIGHT_APP_KEEP"] === undefined) {
      rmSync(join(fixture, ".light"), { recursive: true, force: true });
      rmSync(join(fixture, ".deployed"), { recursive: true, force: true });
    }
    if (output.includes("Error")) console.log(output);
  }
  done();
};

await main();
