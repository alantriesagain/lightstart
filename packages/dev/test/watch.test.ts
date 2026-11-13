// node-only
/**
 * @file The watcher's debounced, project-relative changes (with `node_modules`, `.git` and
 * `.deployed` ignored), and a websocket receiving the file-changed broadcast.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachSockets } from "../node/hmr.ts";
import { startWatcher, type FileChangeEvent } from "../node/watch.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const log = { log() {}, warn() {}, error() {}, debug() {} };
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check: () => boolean, ms = 3000): Promise<boolean> => {
  const start = Date.now();
  while (!check() && Date.now() - start < ms) await sleep(25);
  return check();
};

const main = async (): Promise<void> => {
  const project = mkdtempSync(join(tmpdir(), "dev-watch-"));
  const events: FileChangeEvent[] = [];
  try {
    mkdirSync(join(project, "views"));
    mkdirSync(join(project, ".deployed"));
    mkdirSync(join(project, "node_modules"));
    const watcher = startWatcher(project, (event) => events.push(event), log);
    writeFileSync(join(project, "views", "home.js"), "1");
    ok("a project change arrives", await until(() => events.some((event) => event.path === "views/home.js")));
    writeFileSync(join(project, ".deployed", "out.js"), "x");
    writeFileSync(join(project, "node_modules", "x.js"), "x");
    await sleep(200);
    ok("build output and node_modules are ignored", !events.some((event) => event.path.includes(".deployed") || event.path.includes("node_modules")));
    watcher.close();
    const before = events.length;
    writeFileSync(join(project, "views", "other.js"), "x");
    await sleep(200);
    eq("nothing after close", String(events.length), String(before));
  } finally {
    rmSync(project, { recursive: true, force: true });
  }

  const server: Server = createServer((_req, res) => res.end("ok"));
  const sockets = attachSockets(server, []);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  try {
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject(new Error("no websocket")));
    });
    const message = new Promise<string>((resolve) => socket.addEventListener("message", (event) => resolve(String(event.data)), { once: true }));
    sockets.broadcast({ type: "file-changed", path: "views/home.js" });
    eq("the reload client hears the change", await message, JSON.stringify({ type: "file-changed", path: "views/home.js" }));
  } finally {
    socket.close();
    sockets.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  done();
};

await main();
