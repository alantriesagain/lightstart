// node-only
/**
 * @file End to end: `light new web demo` with the install, then the new project's own scripts.
 * The tree holds an app config, a model, a controller, three views, routes and a browser test;
 * `light build` writes `.deployed/current`, `light test` passes the browser test, `light check`
 * passes light's conventions, and the server answers `/` and the generated `/.light/main.ts`.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
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

type Variant = { name: string; flag: string; ext: "js" | "ts" };

const variants: readonly Variant[] = [
  { name: "demo", flag: "", ext: "js" },
  { name: "demo-ts", flag: "--ts", ext: "ts" },
];

const filesUnder = (dir: string): string[] => readdirSync(dir, { recursive: true, withFileTypes: false }).map(String);

const main = async (): Promise<void> => {
  const root = findCheckout();
  ok("the tests run from a checkout", root !== null);
  if (root === null) return;

  const temp = mkdtempSync(join(tmpdir(), "create-e2e-"));
  try {
    for (const variant of variants) {
      const target = join(temp, variant.name);
      const label = `${variant.ext}: `;
      let server: ReturnType<typeof spawn> | null = null;
      try {
        const created = await run(
          process.execPath,
          [join(root, "packages", "cli", "bin", "light.js"), "new", "web", variant.name, "--dir", target, "--light", root, ...(variant.flag === "" ? [] : [variant.flag])],
          root,
        );
        ok(`${label}light new exits 0`, created.code === 0);
        if (created.code !== 0) {
          console.log(created.output);
          continue;
        }
        for (const file of [
          "package.json",
          "index.html",
          `src/app.${variant.ext}`,
          `src/models/note.${variant.ext}`,
          `src/controllers/notes.${variant.ext}`,
          `src/routes.${variant.ext}`,
          `src/views/app-root.${variant.ext}`,
          `src/views/app-home.${variant.ext}`,
          `src/views/app-about.${variant.ext}`,
          `test/app.test.${variant.ext}`,
          "README.md",
          "AGENTS.md",
          ".gitignore",
        ])
          ok(`${label}the project has ${file}`, existsSync(join(target, file)));

        if (variant.ext === "js") {
          const sources = [...filesUnder(join(target, "src")), ...filesUnder(join(target, "test"))];
          ok("js: no .ts file under src/ or test/", !sources.some((file) => file.endsWith(".ts")));
        }

        const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as { dependencies: Record<string, string>; scripts: Record<string, string> };
        ok(`${label}the manifest links light`, manifest.dependencies["@lightstart/light"]?.startsWith("link:") === true);
        ok(`${label}the manifest links the app layer`, manifest.dependencies["@lightstart/app"]?.startsWith("link:") === true);
        ok(`${label}test runs both languages`, manifest.scripts.test === "light test test/*.test.*");

        const built = await run(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "build"], target);
        ok(`${label}light build exits 0`, built.code === 0);
        if (built.code !== 0) {
          console.log(built.output);
          continue;
        }
        const page = join(target, ".deployed", "current", "index.html");
        ok(`${label}the build writes current/index.html`, existsSync(page));
        const html = readFileSync(page, "utf8");
        ok(`${label}the page points at a hashed script`, /src="\.?\/?[^"]*module-[^"]+\.js"/.test(html));
        ok(`${label}the stylesheet is hashed too`, /href="[^"]*style-[^"]+\.css"/.test(html));

        const tested = await run("pnpm", ["run", "test"], target);
        ok(`${label}the project's browser test passes`, tested.code === 0);
        if (tested.code !== 0) console.log(tested.output);

        const checked = await run("pnpm", ["run", "check"], target);
        ok(`${label}the project's check passes`, checked.code === 0);
        if (checked.code !== 0) console.log(checked.output);

        const port = await freePort();
        server = spawn(process.execPath, [join(root, "packages", "cli", "bin", "light.js"), "serve", "--port", String(port), "--host", "127.0.0.1"], { cwd: target, stdio: ["ignore", "pipe", "pipe"] });
        let log = "";
        server.stdout?.on("data", (chunk: Buffer) => (log += chunk.toString()));
        server.stderr?.on("data", (chunk: Buffer) => (log += chunk.toString()));

        const rootResponse = await waitFor(`http://127.0.0.1:${port}/`);
        ok(`${label}the server answers /`, rootResponse.status === 200);
        const moduleResponse = await waitFor(`http://127.0.0.1:${port}/.light/main.${variant.ext}`);
        ok(`${label}the server answers the generated .light/main.${variant.ext}`, moduleResponse.status === 200);
        if (!(rootResponse.ok && moduleResponse.ok)) console.log(log);
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
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

await main();
done();
