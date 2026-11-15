// node-only
/**
 * @file End to end: `light new web demo` with the install, then `light build` and `light serve` in
 * the new project. The build writes `.deployed/current/index.html` with a hashed script, and the
 * server answers `/` and `/src/main.ts`.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCheckout } from "../generate.ts";
import { done, ok } from "@lightstart/test/assert.ts";

type Run = { code: number | null; output: string };

const run = (command: string, args: readonly string[], cwd: string): Promise<Run> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });

const waitFor = async (url: string): Promise<Response> => {
  const started = Date.now();
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // the server may not be listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`no answer from ${url}`);
};

const main = async (): Promise<void> => {
  const root = findCheckout();
  ok("the tests run from a checkout", root !== null);
  if (root === null) return;

  const temp = mkdtempSync(join(tmpdir(), "create-e2e-"));
  const target = join(temp, "demo");
  let serves = false;
  let server: ReturnType<typeof spawn> | null = null;
  try {
    const created = await run(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "new", "web", "demo", "--dir", target, "--light", root], root);
    ok("light new exits 0", created.code === 0);
    if (created.code !== 0) {
      console.log(created.output);
      return;
    }
    for (const file of ["package.json", "index.html", "src/main.ts", "src/views/app-root.ts", "test/app.test.ts", "README.md", "AGENTS.md", ".gitignore"]) ok(`the project has ${file}`, existsSync(join(target, file)));

    const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    ok("the manifest links light", manifest.dependencies["@lightstart/light"]?.startsWith("link:") === true);

    const built = await run(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "build"], target);
    ok("light build exits 0", built.code === 0);
    if (built.code !== 0) {
      console.log(built.output);
      return;
    }
    const page = join(target, ".deployed", "current", "index.html");
    ok("the build writes current/index.html", existsSync(page));
    const html = readFileSync(page, "utf8");
    ok("the page points at a hashed script", /src="\.?\/?[^"]*module-[^"]+\.js"/.test(html));
    ok("the stylesheet is hashed too", /href="[^"]*style-[^"]+\.css"/.test(html));

    const port = await freePort();
    server = spawn(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "serve", "--port", String(port), "--host", "127.0.0.1"], { cwd: target, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    server.stdout?.on("data", (chunk: Buffer) => (log += chunk.toString()));
    server.stderr?.on("data", (chunk: Buffer) => (log += chunk.toString()));

    const rootResponse = await waitFor(`http://127.0.0.1:${port}/`);
    ok("the server answers /", rootResponse.status === 200);
    const moduleResponse = await waitFor(`http://127.0.0.1:${port}/src/main.ts`);
    ok("the server answers /src/main.ts", moduleResponse.status === 200);
    serves = rootResponse.ok && moduleResponse.ok;
    if (!serves) console.log(log);
  } finally {
    if (server !== null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          server?.kill("SIGKILL");
          resolve(undefined);
        }, 3000);
        server?.on("close", () => {
          clearTimeout(timer);
          resolve(undefined);
        });
      });
    }
    rmSync(temp, { recursive: true, force: true });
  }
};

await main();
done();
