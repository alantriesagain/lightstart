/**
 * @file The worker `serveThreads` spawns in the test: an app whose route names the thread answering
 * it, served by `serveWorker` until the primary closes it. Not a test itself.
 */
import { threadId } from "node:worker_threads";
import { App } from "../app.ts";
import { text } from "../reply.ts";
import { serveWorker } from "../node/index.ts";

const main = async (): Promise<void> => {
  const app = new App().get("/id", () => text(String(threadId)));
  await serveWorker(app);
};

void main();
