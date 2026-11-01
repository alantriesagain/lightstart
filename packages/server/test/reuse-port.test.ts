/**
 * @file `reusePort` on the node adapter: two `serve` calls share one explicit port, each answering
 * some of the requests; and it refuses a Unix socket path or a port that is 0 or absent.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { text } from "../reply.ts";
import { serve } from "../node/index.ts";
import { freePort } from "./ports.ts";
import { done, eqn, ok } from "@light/test/assert.ts";

const messageOf = async (work: Promise<unknown>): Promise<string> => {
  try {
    await work;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
};

const main = async (): Promise<void> => {
  const port = await freePort();
  const one = new App().get("/", () => text("one"));
  const two = new App().get("/", () => text("two"));
  const first = await serve(one, { port, host: "127.0.0.1", reusePort: true });
  const second = await serve(two, { port, host: "127.0.0.1", reusePort: true });
  eqn("two servers listen on the one explicit port", first.port + second.port, port * 2);

  const base = "http://127.0.0.1:" + String(port) + "/";
  let fromOne = 0;
  let fromTwo = 0;
  for (let i = 0; i < 64; i++) {
    const response = await fetch(base, { headers: { connection: "close" } });
    const body = await response.text();
    if (body === "one") fromOne++;
    else if (body === "two") fromTwo++;
  }
  ok("both listeners answer some requests", fromOne > 0 && fromTwo > 0);

  await first.close();
  await second.close();

  const pathError = await messageOf(serve(new App(), { path: "/tmp/light-reuse-port.sock", reusePort: true }));
  ok("reusePort refuses a path", pathError.includes("reusePort"));
  const zeroError = await messageOf(serve(new App(), { port: 0, reusePort: true }));
  ok("reusePort refuses port 0", zeroError.includes("reusePort"));
  const absentError = await messageOf(serve(new App(), { reusePort: true }));
  ok("reusePort refuses an absent port", absentError.includes("reusePort"));
  done();
};

main();
