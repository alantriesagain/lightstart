// node-only
/// <reference lib="dom" />
/**
 * @file The `push` controller against a fake mobile shell: turning pushes on,
 * the registration body the endpoint receives, the two events, a refusal, and
 * the answer outside the shell.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { configurePush, push, pushReceived, pushToken } from "../page/index.ts";
import type { PushMessage } from "../types.ts";

type Row = Record<string, unknown>;

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

const main = async (): Promise<void> => {
  let granted = true;
  let token = "tok-1";
  const listeners = new Map<string, (payload: unknown) => void>();
  const shell = {
    present: true,
    request: async <T>(method: string): Promise<T> => {
      if (method === "PUSH:PERMISSION") return { granted } as T;
      if (method === "PUSH:TOKEN") return { token, platform: "android" } as T;
      throw new Error(`unexpected ${method}`);
    },
    on(event: string, fn: (payload: unknown) => void): () => void {
      listeners.set(event, fn);
      return () => {
        listeners.delete(event);
      };
    },
  };

  const posted: Array<{ body: Row; authorization: string }> = [];
  const fakeFetch = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    posted.push({ body: JSON.parse(String(init?.body)) as Row, authorization: headers.authorization ?? "" });
    return Response.json({ ok: true });
  }) as typeof fetch;

  configurePush({ mobile: shell, fetch: fakeFetch, storage, token: () => "session-1", locale: () => "pt-BR" });
  storage.map.clear();
  await push.dispose();
  await push.$ready;

  eq("outside a call the state is off", push.status, "off");
  ok("a device id was made and kept", push.deviceId.length >= 16 && storage.map.get("push:deviceId") === push.deviceId);

  const enabled = await push.enable();
  eq("enable answers on", JSON.stringify(enabled), JSON.stringify({ ok: true, status: "on" }));
  eqn("one registration was posted", posted.length, 1);
  eq(
    "with this device's id, token, platform and locale",
    JSON.stringify(posted[0]?.body),
    JSON.stringify({ id: push.deviceId, token: "tok-1", platform: "android", locale: "pt-BR" }),
  );
  eq("and the session as its bearer", posted[0]?.authorization, "Bearer session-1");
  eq("the status is kept on the device", storage.map.get("push:status") ?? "", "on");
  eq("a second enable changes nothing", JSON.stringify(await push.enable()), JSON.stringify({ ok: true, status: "on" }));
  eqn("so it posts nothing again", posted.length, 1);

  const received: PushMessage[] = [];
  const tokens: Array<{ token: string; platform?: string }> = [];
  const offReceived = pushReceived.on((message) => received.push(message));
  const offToken = pushToken.on((value) => tokens.push(value));

  token = "tok-2";
  listeners.get("push:token")?.({ token: "tok-2" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  eq("a new token is an event", JSON.stringify(tokens), JSON.stringify([{ token: "tok-2" }]));
  eqn("and registers the new token", posted.length, 2);
  eq("with the token the shell now reports", String(posted[1]?.body["token"] ?? ""), "tok-2");

  listeners.get("push:received")?.({ id: "alert:1", title: "Bia", body: "Hi", url: "/live/1" });
  eq("a push is an event with its id, title, body and url", JSON.stringify(received), JSON.stringify([{ id: "alert:1", title: "Bia", body: "Hi", url: "/live/1" }]));
  offReceived();
  offToken();

  granted = false;
  storage.map.clear();
  await push.dispose();
  await push.$ready;
  eq("a refusal leaves the state denied", JSON.stringify(await push.enable()), JSON.stringify({ ok: true, status: "denied" }));
  eqn("and registers nothing", posted.length, 2);

  configurePush({ mobile: { present: false, request: async <T>(): Promise<T> => ({} as T), on: (): (() => void) => () => {} } });
  storage.map.clear();
  await push.dispose();
  await push.$ready;
  eq("outside the shell enable says so", JSON.stringify(await push.enable()), JSON.stringify({ error: "push needs the mobile shell", status: 0 }));

  done();
};

await main();
