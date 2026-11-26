// node-only
/**
 * @file The `moderationQueue` controller over a fake `/api/moderation`: the
 * pending list grouped under its kinds' headings, and approve, reject and
 * remove calling the review endpoints with the session's bearer.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { configureAuth, writeToken } from "@lightstart/auth/page";

import moderationQueue from "../queue/controller.ts";
import { queueKinds } from "../queue/slots.ts";

type Row = Record<string, unknown>;

interface Call {
  method: string;
  path: string;
  body: Row;
  authorization: string;
}

const calls: Call[] = [];

const rows: Row[] = [
  { id: "s1", kind: "avatar", status: "pending", created: "2026-09-01T10:00:00.000Z", userId: "u1", payload: { image: "data:image/png;base64,AAAA" } },
  { id: "s2", kind: "place", status: "pending", created: "2026-09-02T10:00:00.000Z", userId: "u2", payload: { name: "Praia de Ipanema" } },
];

const respond = (body: unknown, status = 200): Response => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(href, "http://app.test").pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  const authorization = headers.get("authorization") ?? "";
  const body = typeof init?.body === "string" && init.body !== "" ? (JSON.parse(init.body) as Row) : {};
  calls.push({ method, path, body, authorization });
  if (method === "GET" && path === "/api/moderation/pending") return respond({ rows });
  if (method === "PATCH") return respond({});
  if (method === "DELETE") return respond({ deleted: true });
  return respond({ error: "no route" }, 404);
}) as typeof fetch;

const storage = {
  map: new Map<string, string>(),
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  },
  removeItem(key: string): void {
    this.map.delete(key);
  },
};

const withdraw = [
  queueKinds.fill({ kind: "avatar", label: "Profile photo", group: "Photos", icon: "user-round", detail: "moderation-queue-photo" }),
  queueKinds.fill({ kind: "place", label: "Place", group: "Places", icon: "map" }),
];

const run = async (): Promise<void> => {
  configureAuth({ fetch: fakeFetch, storage });
  writeToken("token-1");

  await moderationQueue.$ready;
  calls.length = 0;
  await moderationQueue.load();
  eqn("the pending rows are the queue", moderationQueue.items.length, 2);
  eq("a kind's own title", moderationQueue.items[0]?.title, "Profile photo");
  eq("a payload's name", moderationQueue.items[1]?.title, "Praia de Ipanema");

  const groups = moderationQueue.groups();
  eq("the kinds' headings, in the order they were described", groups.map((group) => group.label).join(","), "Photos,Places");
  eq("newest first inside a heading", groups[1]?.items.map((item) => item.id).join(","), "s2");

  const first = calls.find((call) => call.method === "GET");
  eq("the pending list comes from the admin endpoint", first?.path ?? "", "/api/moderation/pending");
  eq("the fetch carries the session", first?.authorization ?? "", "Bearer token-1");

  calls.length = 0;
  const approved = await moderationQueue.approve("s1");
  ok("approve answers ok", approved.ok);
  const patch = calls.find((call) => call.method === "PATCH");
  eq("approve patches the submission", patch?.path ?? "", "/api/moderation/submissions/s1");
  eq("approve sets the status", String(patch?.body["status"] ?? ""), "approved");
  eq("the review carries the session", patch?.authorization ?? "", "Bearer token-1");

  calls.length = 0;
  const rejected = await moderationQueue.reject("s2", "not a place");
  ok("reject answers ok", rejected.ok);
  const patchRejected = calls.find((call) => call.method === "PATCH");
  eq("reject patches the submission", patchRejected?.path ?? "", "/api/moderation/submissions/s2");
  eq("reject sets the status", String(patchRejected?.body["status"] ?? ""), "rejected");
  eq("reject carries the note", String(patchRejected?.body["note"] ?? ""), "not a place");

  calls.length = 0;
  const removed = await moderationQueue.remove("s1");
  ok("remove answers ok", removed.ok);
  const deletion = calls.find((call) => call.method === "DELETE");
  eq("remove deletes the submission", deletion?.path ?? "", "/api/moderation/submissions/s1");
  eq("the removal carries the session", deletion?.authorization ?? "", "Bearer token-1");

  for (const off of withdraw) off();
  await moderationQueue.dispose();
  done();
};

void run();
