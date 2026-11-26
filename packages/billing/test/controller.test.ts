// node-only
/**
 * @file The `billing` controller over a fake `/api/billing`: holds and trials
 * read the session, plans come from the configured data, and a failed call is
 * a message rather than a throw.
 */

import { auth, configureAuth } from "@lightstart/auth/page";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import billing from "../page/controller.ts";

import type { BillingConfig } from "../types.ts";

type Row = Record<string, unknown>;

const CONFIG: BillingConfig = {
  plans: {
    place: { amount: 4900, currency: "BRL", periodDays: 30, implies: ["spot"] },
    pro: { amount: 9900, currency: "BRL", periodDays: 30, trialDays: 7 },
  },
  providers: { pix: { data: ["payer"], key: "a-key" } },
  contexts: ["claim"],
};

const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
const past = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 19).replace("T", " ");

interface Call {
  method: string;
  path: string;
  body: Row;
  authorization: string;
}

const calls: Call[] = [];
let trialStatus = 201;
let entitlements: Record<string, string> = {};
let currentUser: Row = { id: "ana", name: "Ana", email: null, admin: false };

const respond = (body: unknown, status = 200): Response => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(href, "http://app.test").pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  const body = typeof init?.body === "string" && init.body !== "" ? (JSON.parse(init.body) as Row) : {};
  calls.push({ method, path, body, authorization: headers.get("authorization") ?? "" });
  if (method === "GET" && path === "/api/billing/entitlements") return respond({ entitlements, heldBefore: [] });
  if (method === "POST" && path === "/api/billing/trial") {
    if (trialStatus >= 400) return respond({ error: "this account has held the plan" }, trialStatus);
    entitlements = { ...entitlements, pro: future };
    return respond({ id: "trial:pro:ana" }, trialStatus);
  }
  if (method === "GET" && path === "/api/auth/me") return respond({ user: currentUser });
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

const run = async (): Promise<void> => {
  configureAuth({ fetch: fakeFetch, storage });
  storage.setItem("light-auth:token", "token-1");
  await auth.$ready;
  auth.user = { id: "ana", name: "Ana", email: null, admin: false, entitlements: { place: future, spot: past }, heldBefore: ["spot"] } as never;
  await billing.$ready;
  billing.configure(CONFIG);

  ok("holds a plan the session says runs out later", billing.holds("place"));
  ok("does not hold one that ran out", billing.holds("spot") === false);
  ok("holds something", billing.holdsAny());
  ok("expiresOf reads the session's date", Math.abs(billing.expiresOf("place") - Date.parse(`${future.replace(" ", "T")}Z`)) < 1000);
  eq("the plans are the project's", Object.keys(billing.plans()).sort().join(","), "place,pro");
  eq("a method's settings are the project's", String(billing.method("pix")?.["key"] ?? ""), "a-key");
  ok("a trial is offered for a plan never held", billing.canTry("pro"));
  ok("not for a plan the account already held", billing.canTry("spot") === false);

  calls.length = 0;
  trialStatus = 201;
  currentUser = { ...currentUser, entitlements: { place: future, pro: future } };
  const started = await billing.startTrial("pro");
  ok("startTrial answers ok", started.ok);
  const ask = calls.find((call) => call.method === "POST" && call.path === "/api/billing/trial");
  eq("it asks the trial endpoint with the plan", String(ask?.body["plan"] ?? ""), "pro");
  eq("with the session's bearer", ask?.authorization ?? "", "Bearer token-1");
  ok("and holds the plan afterwards", billing.holds("pro"));

  calls.length = 0;
  trialStatus = 409;
  const refused = await billing.startTrial("pro");
  ok("a refused trial answers not ok", refused.ok === false);
  eq("and leaves the reason as a message", billing.message, "this account has held the plan");

  calls.length = 0;
  auth.user = null;
  await billing.load();
  eqn("signed out, nothing is held", Object.keys(billing.entitlements).length, 0);
  ok("and holds nothing", billing.holds("pro") === false);

  await billing.dispose();
  await auth.dispose();
  done();
};

void run();
