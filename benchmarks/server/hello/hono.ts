// The hello workload (GET/POST /) on Hono, served by @hono/node-server: fastify/benchmarks'
// hello world, parsed JSON bodies and a /shutdown route that reports how many requests were answered.
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

const app = new Hono();

let requests = 0;
let server: ServerType | null = null;

app.get("/", (c) => {
  requests++;
  return c.json({ hello: "world" });
});

app.post("/", async (c) => {
  requests++;
  const body = await c.req.json<Record<string, unknown>>();
  return c.json(body);
});

app.post("/shutdown", (c) => {
  const current = server;
  const response = c.json({ bye: true });
  if (current !== null) {
    setTimeout(() => {
      current.close(() => {
        process.stdout.write("requests " + requests + "\n");
        process.exit(0);
      });
    }, 0);
  }
  return response;
});

server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, (info) => {
  process.stderr.write("PORT " + info.port + "\n");
});
