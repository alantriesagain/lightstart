// node-only
/**
 * @file The canvas preview server: one canvas at `/`, every canvas under one index, a canvas added
 * while it runs, the next port when the first is busy, and the `serve:after` hook that starts the
 * canvases beside `light serve`.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandContext, HookTeardown } from "@lightstart/cli";
import type { ServeAfterPayload } from "@lightstart/dev";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import serveAfter from "../cli/hooks/serve.after.ts";
import { listenCanvas, serveCanvas, serveCanvases } from "../serve.ts";

const canvas = (root: string, name: string): string => {
  const dir = join(root, "design", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "directions.mjs"), "export default {};\n");
  writeFileSync(join(dir, "build.mjs"), "");
  writeFileSync(join(dir, "canvas.json"), `${JSON.stringify({ title: name, boards: {}, notes: {} })}\n`);
  writeFileSync(join(dir, "preview.html"), `<!doctype html><title>${name}</title>`);
  return dir;
};

const main = async (): Promise<void> => {
  const root = mkdtempSync(join(tmpdir(), "light-design-serve-"));
  try {
    writeFileSync(join(root, "preview.html"), "<!doctype html><title>preview</title>");
    writeFileSync(join(root, "Home.dc.html"), "<x-dc>home</x-dc>");
    const server = await serveCanvas(root, { port: 0 });
    try {
      const preview = await fetch(server.url);
      eq("the preview answers at /", String(preview.status), "200");
      ok("the preview is HTML", (preview.headers.get("content-type") || "").includes("text/html"));
      ok("the preview is served", (await preview.text()).includes("preview"));

      const board = await fetch(new URL("/Home.dc.html", server.url));
      eq("a board answers beside it", String(board.status), "200");
      ok("the board is served", (await board.text()).includes("home"));

      eq("a missing file is 404", String((await fetch(new URL("/missing.html", server.url))).status), "404");
    } finally {
      await server.close();
    }

    const second = await serveCanvas(root, { port: 0 });
    try {
      const next = await listenCanvas(root, { port: second.port === 65535 ? 65534 : second.port });
      try {
        ok("the next port is taken when the first is busy", next.port !== second.port);
      } finally {
        await next.close();
      }
    } finally {
      await second.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  const project = mkdtempSync(join(tmpdir(), "light-design-serve-"));
  try {
    canvas(project, "mobile");
    canvas(project, "admin");
    const server = await serveCanvases(project, { port: 0 });
    try {
      const index = await fetch(server.url);
      eq("the index answers", String(index.status), "200");
      const html = await index.text();
      ok("the index links a canvas", html.includes('href="/mobile/preview.html"'));
      ok("the index links every canvas", html.includes('href="/admin/preview.html"'));

      const preview = await fetch(new URL("/mobile/preview.html", server.url));
      eq("a canvas preview answers under its name", String(preview.status), "200");
      ok("the canvas preview is served", (await preview.text()).includes("mobile"));

      const directory = await fetch(new URL("/admin/", server.url));
      eq("a canvas folder answers at /", String(directory.status), "200");
      ok("the folder opens its preview", (await directory.text()).includes("admin"));

      eq("an unknown canvas is 404", String((await fetch(new URL("/nope/", server.url))).status), "404");

      eq("a canvas added later is absent first", String((await fetch(new URL("/web/preview.html", server.url))).status), "404");
      canvas(project, "web");
      ok("a canvas added later is listed", (await (await fetch(server.url)).text()).includes('href="/web/preview.html"'));
      eq("a canvas added later answers", String((await fetch(new URL("/web/preview.html", server.url))).status), "200");
    } finally {
      await server.close();
    }
  } finally {
    rmSync(project, { recursive: true, force: true });
  }

  const hookRoot = mkdtempSync(join(tmpdir(), "light-design-serve-"));
  try {
    const dir = canvas(hookRoot, "mobile");
    rmSync(join(dir, "preview.html"));
    const logs: string[] = [];
    const warnings: string[] = [];
    const ctx = { log: { log: (line: string) => logs.push(line), warn: (line: string) => warnings.push(line) } } as unknown as CommandContext;
    const payload: ServeAfterPayload = { projectDir: hookRoot, port: 0, watch: false, ephemeral: false, origins: { local: "http://localhost:3400" } };
    const teardown = await serveAfter(ctx, payload);
    try {
      ok("the hook returns a teardown", typeof teardown === "function");
      ok("the hook writes a missing preview", existsSync(join(dir, "preview.html")));
      const line = logs.find((entry) => entry.startsWith("Design canvases: "));
      ok("the hook logs the canvas URL", line !== undefined);
      const url = line === undefined ? "" : line.slice("Design canvases: ".length);
      eq("the canvas server answers", String((await fetch(url)).status), "200");
      eq("the hook warns about nothing", warnings.join(","), "");
    } finally {
      if (typeof teardown === "function") await (teardown as HookTeardown)();
    }

    const skipped: unknown[] = [];
    const quiet = { log: { log: (line: string) => skipped.push(line), warn: (line: string) => skipped.push(line) } } as unknown as CommandContext;
    const result = await serveAfter(quiet, { projectDir: hookRoot, port: 0, watch: false, ephemeral: true, origins: { local: "http://localhost:3400" } });
    eq("an ephemeral server is left alone", result === undefined ? "undefined" : "a teardown", "undefined");
    eq("and says nothing", String(skipped.length), "0");
  } finally {
    rmSync(hookRoot, { recursive: true, force: true });
  }
  done();
};

await main();
