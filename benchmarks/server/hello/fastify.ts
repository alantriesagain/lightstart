// The hello workload (GET/POST /) on Fastify 5: fastify/benchmarks' hello world, with a 200
// response schema so fast-json-stringify serializes, Fastify's built-in JSON parser echoing the
// POST body, and a /shutdown route that reports how many requests were answered.
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

const schema = {
  response: {
    200: {
      type: "object",
      properties: {
        hello: { type: "string" },
      },
    },
  },
} as const;

const app = Fastify({ logger: false });

let requests = 0;

app.get("/", { schema }, (_request: FastifyRequest, reply: FastifyReply) => {
  requests++;
  return reply.send({ hello: "world" });
});

app.post("/", { schema }, (request: FastifyRequest, reply: FastifyReply) => {
  requests++;
  return reply.send(request.body);
});

app.post("/shutdown", (_request: FastifyRequest, reply: FastifyReply) => {
  reply.send({ bye: true });
  setTimeout(() => {
    app.close().then(() => {
      process.stdout.write("requests " + requests + "\n");
      process.exit(0);
    });
  }, 0);
});

await app.listen({ port: 0, host: "127.0.0.1" });
const address = app.server.address();
if (address !== null && typeof address === "object") process.stderr.write("PORT " + address.port + "\n");
