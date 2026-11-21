/**
 * @file The local canvas server: one canvas's folder at `/`, or every canvas under a project at
 * `/<canvas>/` with an index at `/`. It takes the next port when the first is busy, and stays up
 * until a signal.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { canvasDir, canvasNames } from "./canvas.ts";
import type { CanvasServer, ServeOptions } from "./types.ts";

const TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const indexPage = (names: string[]): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Design canvases</title>
<style>
html,body{margin:0;min-height:100%;background:#e9e7e2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111}
main{max-width:640px;margin:0 auto;padding:64px 24px}
h1{font-size:32px;letter-spacing:-.03em;margin:0 0 24px}
ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}
a{display:block;padding:16px 18px;border-radius:16px;background:#fff;color:#111;text-decoration:none;box-shadow:0 4px 14px rgb(0 0 0 / .08)}
a:hover{outline:2px solid #111}
</style></head><body><main><h1>Design canvases</h1><ul>${names.map((name) => `<li><a href="/${name}/preview.html">${name}</a></li>`).join("")}</ul></main></body></html>
`;

const answer = (root: string, pathname: string, req: IncomingMessage, res: ServerResponse): void => {
  if (pathname === "/") pathname = "/preview.html";
  let file: string;
  try {
    file = normalize(join(root, decodeURIComponent(pathname)));
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
};

const listen = async (
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  { port = 5097, host = "127.0.0.1", path = "/preview.html" }: ServeOptions & { path?: string } = {},
): Promise<CanvasServer> => {
  const start = port === 0 ? 0 : port;
  const last = port === 0 ? 0 : port + 19;
  let server = createServer(handler);
  for (let attempt = start; ; attempt++) {
    server = createServer(handler);
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(attempt, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      break;
    } catch (err) {
      if (start === 0 || (err as { code?: string }).code !== "EADDRINUSE" || attempt >= last) throw err;
    }
  }
  const address = server.address();
  const actual = typeof address === "object" && address !== null ? address.port : port;
  let closed = false;
  return {
    url: `http://${host}:${actual}${path}`,
    port: actual,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

/**
 * Serve one canvas folder. `/` opens `preview.html`; every other path is a file under the folder.
 *
 * @param dir The canvas folder.
 * @param options The port and host; port 0 asks the system.
 * @returns The listening server.
 */
export const serveCanvas = (dir: string, { port = 5097, host = "127.0.0.1" }: ServeOptions = {}): Promise<CanvasServer> => {
  const root = normalize(dir);
  return listen((req, res) => {
    let pathname: string;
    try {
      pathname = new URL(req.url || "/", `http://${host}`).pathname;
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }
    answer(root, pathname, req, res);
  }, { port, host });
};

/**
 * Serve every canvas under a project at `/<canvas>/`, with an index at `/`. The canvases are listed
 * on each request, so one added while the server runs shows up without a restart.
 *
 * @param projectDir The project folder.
 * @param options The port and host; port 0 asks the system.
 * @returns The listening server.
 */
export const serveCanvases = (projectDir: string, { port = 5097, host = "127.0.0.1" }: ServeOptions = {}): Promise<CanvasServer> =>
  listen((req, res) => {
    const names = canvasNames(projectDir);
    let pathname: string;
    try {
      pathname = new URL(req.url || "/", `http://${host}`).pathname;
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(indexPage(names));
      return;
    }
    const segments = pathname.split("/").filter(Boolean);
    const name = segments[0] || "";
    if (!names.includes(name)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const rest = segments.slice(1);
    answer(normalize(canvasDir(projectDir, name)), rest.length ? `/${rest.join("/")}` : "/", req, res);
  }, { port, host, path: "/" });

/**
 * Serve a canvas, taking the next port when the first is busy. Port 0 asks the system for a free port.
 *
 * @param dir The canvas folder.
 * @param options The port and host.
 * @returns The listening server.
 */
export const listenCanvas = (dir: string, { port = 5097, host = "127.0.0.1" }: ServeOptions = {}): Promise<CanvasServer> => serveCanvas(dir, { port, host });

/**
 * Serve every canvas, taking the next port when the first is busy.
 *
 * @param projectDir The project folder.
 * @param options The port and host.
 * @returns The listening server.
 */
export const listenCanvases = (projectDir: string, { port = 5097, host = "127.0.0.1" }: ServeOptions = {}): Promise<CanvasServer> => serveCanvases(projectDir, { port, host });

/**
 * Keep a served canvas alive until Ctrl+C or SIGTERM.
 *
 * @param server The listening server.
 * @returns A promise that settles once the server closed.
 */
export const serveUntilSignal = (server: CanvasServer): Promise<void> =>
  new Promise((resolve) => {
    const stop = (): void => {
      void server.close().then(resolve);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
