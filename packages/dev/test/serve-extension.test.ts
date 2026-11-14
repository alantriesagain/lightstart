// node-only
/**
 * @file `light serve` extended end to end by the fixture package under `test/fixtures/extension`:
 * its `--greet` flag in help, CORS, a handled app, an extra file root, the page renderer, a base
 * path, a watched folder, a build preview and the payload its setup puts in `serve:before`.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const repoRoot = resolve(join(process.cwd(), "..", ".."));
const cliPath = join(repoRoot, "packages", "cli", "bin", "light.js");
const fixture = join(process.cwd(), "test", "fixtures", "extension");
const deployed = join(fixture, ".deployed", "current");
const watchedFile = join(fixture, "vendor", "watched.txt");

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

const until = async (check: () => boolean, ms = 10000): Promise<boolean> => {
  const start = Date.now();
  while (!check() && Date.now() - start < ms) await sleep(50);
  return check();
};

const capture = (args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; out: string }> =>
  new Promise((settle) => {
    const child = spawn(process.execPath, ["--no-warnings", ...args], { cwd: repoRoot, env });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("close", (code) => settle({ code: code ?? 1, out: Buffer.concat(chunks).toString("utf8") }));
  });

const fetchUntil = async (url: string, init?: RequestInit): Promise<Response> => {
  let last: unknown = null;
  for (let i = 0; i < 100; i++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      last = error;
      await sleep(100);
    }
  }
  throw last instanceof Error ? last : new Error("no response from " + url);
};

const main = async (): Promise<void> => {
  const help = await capture([cliPath, "serve", "--help"], { ...process.env, LIGHT_PROJECT_DIR: fixture });
  eqn("light serve --help answers 0", help.code, 0);
  ok("the extension's flag is in the help", help.out.includes("--greet"));

  const port = await freePort();
  const previewPort = await freePort();
  mkdirSync(deployed, { recursive: true });
  writeFileSync(join(deployed, "index.html"), "<html><body>preview-build</body></html>");

  const child: ChildProcessWithoutNullStreams = spawn(
    process.execPath,
    ["--no-warnings", cliPath, "serve", fixture, "--port", String(port), "--watch"],
    { cwd: repoRoot, env: { ...process.env, LIGHT_PROJECT_DIR: fixture, EXT_PREVIEW_PORT: String(previewPort), NO_COLOR: "1" } },
  );
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });

  try {
    ok("a payload field reaches serve:before", await until(() => output.includes("[fixture-hook] greeting:hi-from-ext")));

    const origin = `http://127.0.0.1:${port}`;
    const handled = await fetchUntil(`${origin}/handled`);
    eq("the handled app answers", await handled.text(), "handled-app");
    await fetch(`${origin}/settle-write`);
    eq("a route's waitUntil work is done before its reply goes out", await (await fetch(`${origin}/settle-read`)).text(), "done");
    eq("a route file reads the field the extension put in routeContext", await (await fetch(`${origin}/route-greeting`)).text(), "hi-from-route");

    const cors = await fetch(`${origin}/handled`, { headers: { origin: "https://allowed.example" } });
    eq("CORS grants the allowed origin", cors.headers.get("access-control-allow-origin") ?? "", "https://allowed.example");

    const module = await bodyOf(await fetch(`${origin}/vendor-x/mod.js`));
    ok("the extra root strips TypeScript", !module.includes(": number"));
    ok("and rewrites its bare specifier", module.includes('from "/vendor-lib.js"'));

    ok("the page renderer answers the shell", (await bodyOf(await fetch(`${origin}/`))).includes("custom-shell"));

    const redirect = await fetch(`${origin}/base`, { redirect: "manual" });
    eqn("the base path redirects", redirect.status, 302);
    eq("to its slash", redirect.headers.get("location") ?? "", "/base/");
    eq("the app answers under the base path", await bodyOf(await fetch(`${origin}/base/handled`)), "handled-app");
    ok("and its files", (await bodyOf(await fetch(`${origin}/base/vendor-x/mod.js`))).includes('from "/vendor-lib.js"'));

    ok("the build preview listens beside it", (await bodyOf(await fetchUntil(`http://127.0.0.1:${previewPort}/`))).includes("preview-build"));

    writeFileSync(watchedFile, "watched");
    ok("a change in the extra watch folder names its label", await until(() => output.includes("[fixture-file] vendor-x/watched.txt")));
  } finally {
    child.kill("SIGTERM");
    await new Promise<void>((settle) => {
      child.once("close", () => settle());
      setTimeout(settle, 3000);
    });
    rmSync(join(fixture, ".deployed"), { recursive: true, force: true });
    rmSync(watchedFile, { force: true });
  }

  done();
};

const bodyOf = async (reply: Response): Promise<string> => await reply.text();

await main();
