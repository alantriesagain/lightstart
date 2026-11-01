// Fastify's hello benchmark (fastify/benchmarks) on @lightstart/server and its node adapter: GET /
// answers {"hello":"world"}, POST / echoes the parsed JSON body through c.json(), and POST
// /shutdown prints the request count and exits.
import { App, json, type Context } from "@lightstart/server";
import { serve, type NodeServer } from "@lightstart/server/node";

interface Hello {
  hello: string;
}

function helloOf(value: unknown): Hello | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as { hello?: unknown };
  if (typeof record.hello !== "string") return null;
  return { hello: record.hello };
}

let requests = 0;

class Running {
  server: NodeServer | null = null;
}

const running = new Running();

function report(): void {
  console.log("requests " + requests);
}

const app = new App()
  .get("/", () => {
    requests++;
    return json({ hello: "world" });
  })
  .post("/", async (c: Context) => {
    const body = helloOf(await c.json());
    requests++;
    return json(body ?? { hello: "world" });
  })
  .post("/shutdown", () => {
    const server = running.server;
    if (server !== null)
      setTimeout(() => {
        server.close().then(report);
      }, 0);
    return json({ bye: true });
  });

serve(app, { port: 0, host: "127.0.0.1", grace: 2000 }).then((server: NodeServer) => {
  running.server = server;
  process.stderr.write("PORT " + server.port + "\n");
});
