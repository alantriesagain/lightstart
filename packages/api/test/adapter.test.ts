// node-only
/// <reference lib="dom" />
/**
 * @file The `api` store over a fake fetch: each request's URL and query,
 * `get`/`insert`/`update`/`delete`/`count`, the bearer header, and an error
 * status thrown with the server's message.
 */

import type { App } from "@lightstart/app";
import type { StorageAdapter } from "@lightstart/light/model/types.ts";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { ApiAdapterType, configureApi } from "../page/adapter.ts";

interface Call {
  url: string;
  init: RequestInit | undefined;
}

const calls: Call[] = [];

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const fakeFetch = (handler: (call: Call) => Response): typeof fetch =>
  ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const call: Call = { url, init };
    calls.push(call);
    return Promise.resolve(handler(call));
  }) as typeof fetch;

const openWith = async (handler: (call: Call) => Response, token: () => string | null | Promise<string | null> = () => null): Promise<StorageAdapter> => {
  calls.length = 0;
  configureApi({ fetch: fakeFetch(handler), token, prefix: "" });
  const app = { name: "test" } as unknown as App;
  return new ApiAdapterType().open(app, "api", "", {}, true);
};

const header = (call: Call | undefined, name: string): string | null => new Headers(call?.init?.headers).get(name);

const rejection = async (work: () => Promise<unknown>): Promise<string> => {
  try {
    await work();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const main = async (): Promise<void> => {
  let storage = await openWith(() => response({ rows: [{ id: 1 }], total: 7 }));
  const page = await storage.query("todo", { where: { done: true }, order: "-createdAt", limit: 20, total: true });
  eq("a query encodes where, order, limit and total", calls[0]?.url ?? "", "/api/todo?where=%7B%22done%22%3Atrue%7D&order=%22-createdAt%22&limit=20&total=1");
  eqn("a query answers the page's rows", page.rows.length, 1);
  eqn("a query answers the server's total", page.total, 7);

  storage = await openWith(() => response({ id: 5, text: "x" }));
  const row = await storage.get("todo", 5);
  eq("get reads the row by id", calls[0]?.url ?? "", "/api/todo/5");
  eq("get is a GET", calls[0]?.init?.method ?? "", "GET");
  eq("get answers the row", String(row?.text), "x");

  const inserted = { text: "hi" };
  storage = await openWith(() => response({ id: "a", text: "hi" }));
  await storage.insert("todo", inserted);
  eq("insert posts to the model", calls[0]?.url ?? "", "/api/todo");
  eq("insert is a POST", calls[0]?.init?.method ?? "", "POST");
  eq("insert sends its row as the body", String(calls[0]?.init?.body), JSON.stringify(inserted));

  const updated = { id: "a", text: "new" };
  storage = await openWith(() => response(updated));
  await storage.update("todo", updated);
  eq("update patches the row's id", calls[0]?.url ?? "", "/api/todo/a");
  eq("update is a PATCH", calls[0]?.init?.method ?? "", "PATCH");
  eq("update sends its row as the body", String(calls[0]?.init?.body), JSON.stringify(updated));

  storage = await openWith(() => response({ deleted: true }));
  const removed = await storage.delete("todo", "a");
  eq("delete reads the row by id", calls[0]?.url ?? "", "/api/todo/a");
  eq("delete is a DELETE", calls[0]?.init?.method ?? "", "DELETE");
  eq("delete answers the server's answer", String(removed), "true");

  storage = await openWith(() => response({ count: 3 }));
  const counted = await storage.count("todo", { done: true });
  eq("count reads the model's count route", calls[0]?.url ?? "", "/api/todo/count?where=%7B%22done%22%3Atrue%7D");
  eqn("count answers the server's count", counted, 3);

  storage = await openWith(() => response({ rows: [], total: 0 }), () => "secret");
  await storage.query("todo", {});
  eq("a token provider's answer is the bearer header", header(calls[0], "authorization") ?? "none", "Bearer secret");

  storage = await openWith(() => response({ rows: [], total: 0 }), () => null);
  await storage.query("todo", {});
  eq("a null token sends no bearer header", header(calls[0], "authorization") ?? "none", "none");

  storage = await openWith(() => response({ message: "boom" }, 500));
  const failed = await rejection(() => storage.query("todo", {}));
  ok("an error status is thrown with its status and the server's message", failed.includes("500") && failed.includes("boom"));

  done();
};

await main();
