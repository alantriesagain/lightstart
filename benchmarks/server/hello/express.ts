// The hello workload (GET/POST /) on Express 5: fastify/benchmarks' hello world, parsed
// JSON bodies and a /shutdown route that reports how many requests were answered.
import express from "express";
import type { Request, Response } from "express";
import type { Server } from "node:http";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

let requests = 0;
let server: Server | null = null;

app.get("/", (_req: Request, res: Response) => {
  requests++;
  res.json({ hello: "world" });
});

app.post("/", (req: Request, res: Response) => {
  requests++;
  const body: unknown = req.body;
  res.json(body);
});

app.post("/shutdown", (_req: Request, res: Response) => {
  const current = server;
  res.json({ bye: true });
  if (current !== null) {
    setTimeout(() => {
      current.close(() => {
        process.stdout.write("requests " + requests + "\n");
        process.exit(0);
      });
    }, 0);
  }
});

server = app.listen(0, "127.0.0.1", () => {
  const address = server === null ? null : server.address();
  if (address !== null && typeof address === "object") process.stderr.write("PORT " + address.port + "\n");
});
