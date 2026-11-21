// node-only
/**
 * @file `light serve` under a based app: `/` redirects to the base, the app's
 * page answers under it, a file under the base resolves to the project's own,
 * and the unprefixed path keeps working.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/web-base", import.meta.url));
const cli = fileURLToPath(new URL("../../cli/bin/light.js", import.meta.url));

const freePort = (): Promise<number> =>
  new Promise((settle, reject) => {
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
      return await fetch(url, { redirect: "manual" });
    } catch (error) {
      last = error;
      await sleep(100);
    }
  }
  throw last instanceof Error ? last : new Error("no response from " + url);
};

const main = async (): Promise<void> => {
  const project = mkdtempSync(join(tmpdir(), "light-app-base-serve-"));
  cpSync(fixture, project, {
    recursive: true,
    filter: (path) => !path.includes("node_modules") && !path.includes("/.light") && !path.includes("/.deployed"),
  });
  symlinkSync(join(fixture, "node_modules"), join(project, "node_modules"), "dir");
  const port = await freePort();
  const env = { ...process.env, LIGHT_PROJECT_DIR: project, NO_COLOR: "1" };
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, ["--no-warnings", cli, "serve", "--port", String(port), "--ephemeral"], { cwd: project, env });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  try {
    const origin = `http://127.0.0.1:${String(port)}`;
    const root = await fetchUntil(`${origin}/?from=root`);
    eqn("the root redirects", root.status, 302);
    eq("to the base, keeping the query", root.headers.get("location") ?? "", "/budget/?from=root");
    const page = await fetchUntil(`${origin}/budget/`);
    eqn("the base answers the app's page", page.status, 200);
    ok("with its root", (await page.text()).includes("<app-root>"));
    ok("a route under the base answers the shell", (await fetchUntil(`${origin}/budget/about`)).status === 200);
    const script = await fetchUntil(`${origin}/budget/src/views/app-home.js`);
    eqn("a file under the base resolves to the project's", script.status, 200);
    ok("with its source", (await script.text()).includes("class AppHome"));
    const unprefixed = await fetchUntil(`${origin}/src/views/app-home.js`);
    eqn("and the unprefixed path keeps working", unprefixed.status, 200);
    const rates = await fetchUntil(`${origin}/budget/rates.json`);
    eq("a public file under the base answers", await rates.text(), '{ "usd": 1 }\n');
    eq("a public file without the base answers too", await (await fetchUntil(`${origin}/rates.json`)).text(), '{ "usd": 1 }\n');
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((settle) => {
      child.once("close", () => settle());
      setTimeout(settle, 3000);
    });
    if (output.includes("Error")) console.log(output);
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
