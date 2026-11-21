// node-only
/**
 * @file A project's worker part cannot take a request name or an event name
 * light's worker already serves or relays: `serveModels` refuses it, naming
 * the name, before it installs either table.
 */

import type { Port } from "@lightstart/rpc";
import { event } from "@lightstart/light/signals";
import { done, ok } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import { serveModels } from "../web/worker-entry.ts";

const port: Port = {
  postMessage(_message: unknown): void {},
  addEventListener(_type: string, _listener: (event: { data?: unknown; error?: unknown }) => void): void {},
  removeEventListener(_type: string, _listener: (event: { data?: unknown; error?: unknown }) => void): void {},
};

const app = defineApp({ name: "fixture-worker-clash", host: "web", worker: true });

const caught = (run: () => void): string => {
  try {
    run();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const main = async (): Promise<void> => {
  const serveMessage = caught(() => {
    serveModels({ app, models: {}, worker: { serve: { open: () => null } }, port });
  });
  ok("a project serve handler named like light's is refused", serveMessage.includes("open"));

  const relayMessage = caught(() => {
    serveModels({ app, models: {}, worker: { relay: { modelChanged: event<unknown>() } }, port });
  });
  ok("a project relayed event named like light's is refused", relayMessage.includes("modelChanged"));

  const accepted = caught(() => {
    const served = serveModels({ app, models: {}, worker: { serve: { "worker.ping": () => "pong" }, relay: { archived: event() } }, port });
    served.dispose();
  });
  ok("a project worker part with names of its own is served", accepted === "");
  done();
};

await main();
