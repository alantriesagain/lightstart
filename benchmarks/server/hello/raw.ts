// Fastify's hello benchmark (fastify/benchmarks) on bare node:http: GET / answers
// {"hello":"world"}, POST / echoes the parsed JSON body, and POST /shutdown prints the request
// count and exits.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

interface Hello {
  hello: string;
}

let requests = 0;

function send(res: ServerResponse, body: string): void {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(body);
}

function handle(req: IncomingMessage, res: ServerResponse, body: string): void {
  const method = req.method ?? "GET";
  const path = req.url ?? "/";
  if (method === "POST" && path === "/shutdown") {
    send(res, '{"bye":true}');
    server.close(() => console.log("requests " + requests));
  } else if (method === "GET" && path === "/") {
    requests++;
    send(res, '{"hello":"world"}');
  } else if (method === "POST" && path === "/") {
    requests++;
    let hello: Hello;
    try {
      hello = JSON.parse(body) as Hello;
    } catch {
      hello = { hello: "world" };
    }
    send(res, JSON.stringify(hello));
  } else {
    res.statusCode = 404;
    res.end();
  }
}

const server = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk: Buffer) => {
    body += chunk.toString("utf8");
  });
  req.on("end", () => handle(req, res, body));
});

server.listen(0, "127.0.0.1", () => {
  /* @ts-expect-error */
  process.stderr.write("PORT " + server.address().port + "\n");
});
