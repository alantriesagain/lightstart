/**
 * @file `serveThreads`: three workers the test spawns itself listen on one explicit port, every
 * thread answers some of the requests with its own `threadId`, the primary never listens, and
 * `close()` stops them all and frees the port.
 * Runs under node and natively; the outputs must be identical.
 */
import { Worker } from "node:worker_threads";
import { serveThreads } from "../node/index.ts";
import { freePort, isFree } from "./ports.ts";
import { done, eqn, ok } from "@light/test/assert.ts";

const main = async (): Promise<void> => {
  const port = await freePort();
  const handle = await serveThreads({
    port,
    host: "127.0.0.1",
    threads: 3,
    grace: 1000,
    spawn: (_index: number) => new Worker(new URL("./threads-worker.ts", import.meta.url)),
  });
  eqn("the handle reports the port", handle.port, port);
  eqn("the handle reports the threads that listen", handle.threads, 3);

  const base = "http://127.0.0.1:" + String(port) + "/id";
  const ids: string[] = [];
  for (let i = 0; i < 120; i++) {
    const response = await fetch(base, { headers: { connection: "close" } });
    const id = await response.text();
    if (ids.indexOf(id) < 0) ids.push(id);
  }
  eqn("every thread answers some requests", ids.length, 3);

  await handle.close();
  ok("close() frees the port", await isFree(port));
  await handle.close();
  ok("close() can be called again", true);
  done();
};

main();
