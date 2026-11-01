/**
 * @file `app.mapError` through the memory adapter: the mappers are tried in the order added, the
 * first reply wins, and a null falls through to the next mapper, then to `onError`, then to the
 * default (`HttpError` answering its status, anything else a logged 500). A mapper that throws is
 * itself logged and answers the default 500, and an `HttpError` still answers its own status when
 * no mapper claims it.
 * Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { HttpError } from "../errors.ts";
import { MemoryLogger } from "../logger.ts";
import { Reply, fail, text } from "../reply.ts";
import { bodyOf, request } from "../memory/index.ts";
import { done, eq, eqn } from "@light/test/assert.ts";

const unique = (message: string): boolean => message.indexOf("UNIQUE constraint failed") >= 0;

const main = async (): Promise<void> => {
  const app = new App()
    .logTo(new MemoryLogger())
    .mapError((_c: Context, error: unknown): Reply | null => (error instanceof Error && unique(error.message) ? fail("conflict", 409) : null))
    .mapError((_c: Context, error: unknown): Reply | null => (error instanceof Error && error.message.indexOf("constraint") >= 0 ? fail("bad input", 400) : null))
    .post("/unique", (): Reply => {
      throw new Error("UNIQUE constraint failed: users.email");
    })
    .post("/foreign", (): Reply => {
      throw new Error("FOREIGN KEY constraint failed");
    })
    .post("/other", (): Reply => {
      throw new Error("something else");
    })
    .get("/teapot", (): Reply => {
      throw new HttpError(418, "short and stout");
    });

  const conflict = await request(app, "POST", "/unique");
  eq("the first matching mapper answers", String(conflict.status) + " " + (await bodyOf(conflict)), "409 {\"error\":\"conflict\"}");
  const invalid = await request(app, "POST", "/foreign");
  eq("a null falls through to the next mapper", String(invalid.status) + " " + (await bodyOf(invalid)), "400 {\"error\":\"bad input\"}");
  const other = await request(app, "POST", "/other");
  eq("then to the default 500", String(other.status) + " " + (await bodyOf(other)), "500 {\"error\":\"internal error\"}");
  eqn("an HttpError no mapper claims still answers its status", (await request(app, "GET", "/teapot")).status, 418);

  let first = 0;
  let second = 0;
  const ordered = new App()
    .mapError((_c: Context, _error: unknown): Reply | null => {
      first++;
      return fail("first", 401);
    })
    .mapError((_c: Context, _error: unknown): Reply | null => {
      second++;
      return fail("second", 402);
    })
    .get("/boom", (): Reply => {
      throw new Error("boom");
    });
  eq("only the first matching mapper runs", String((await request(ordered, "GET", "/boom")).status) + " " + String(first) + " " + String(second), "401 1 0");

  const fallback = new App()
    .mapError((_c: Context, error: unknown): Reply | null => (error instanceof Error && unique(error.message) ? fail("conflict", 409) : null))
    .onError((_c: Context, error: unknown): Reply => text("onError: " + (error instanceof Error ? error.message : "?"), 503))
    .get("/unique", (): Reply => {
      throw new Error("UNIQUE constraint failed");
    })
    .get("/other", (): Reply => {
      throw new Error("other");
    });
  eq("a mapper answers before onError", await bodyOf(await request(fallback, "GET", "/unique")), "{\"error\":\"conflict\"}");
  eq("onError is next when no mapper claims it", await bodyOf(await request(fallback, "GET", "/other")), "onError: other");

  const logged = new MemoryLogger();
  const broken = new App()
    .logTo(logged)
    .mapError((): Reply | null => {
      throw new Error("the mapper is broken");
    })
    .onError((): Reply => text("should not run"))
    .get("/boom", (): Reply => {
      throw new Error("boom");
    });
  const threw = await request(broken, "GET", "/boom");
  eq("a mapper that throws answers the default 500, not onError", String(threw.status) + " " + (await bodyOf(threw)), "500 {\"error\":\"internal error\"}");
  eq("and its failure is logged with the request", logged.lines.join(" | "), "GET /boom: the mapper is broken");

  done();
};

main();
