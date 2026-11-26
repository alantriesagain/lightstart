// node-only
/**
 * @file `POST /api/push-device` over `serverApp` and an in-memory database:
 * the row under the session's account, untied when signed out, a token moved
 * to the device now holding it, and the bodies it refuses.
 */

import { applySchema } from "@lightstart/light/model/sql-builder";
import { Database } from "@lightstart/sqlite/node";
import { d1Of, type D1Binding } from "@lightstart/sqlite/d1";
import { toFetch } from "@lightstart/server/fetch";
import { serverApp } from "@lightstart/api/server";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import { pushEndpoints } from "../server/device.ts";
import { pushModels } from "../server/models.ts";

type Row = Record<string, unknown>;

const ID = "3f1c9a52-7b1e-4d0a-9a0e-5c2d8f3e1b77";

const main = async (): Promise<void> => {
  const db = Database.open(":memory:");
  applySchema(db, pushModels);
  const binding: D1Binding = d1Of(db);
  const handle = toFetch(
    serverApp({
      models: pushModels,
      endpoints: pushEndpoints,
      db: () => binding,
      caller: (request) => {
        const header = request.headers.get("authorization");
        return header !== null && header.startsWith("Bearer ") ? { id: header.slice("Bearer ".length) } : null;
      },
      env: {},
    }),
  );
  const send = (path: string, init?: RequestInit): Promise<Response> => handle(new Request(new URL(path, "http://app.test"), init));
  const register = (body: Record<string, unknown>, signedIn = false): Promise<Response> =>
    send("/api/push-device", {
      method: "POST",
      headers: { "content-type": "application/json", ...(signedIn ? { authorization: "Bearer u_ana" } : {}) },
      body: JSON.stringify(body),
    });
  const rows = async (): Promise<Row[]> => (await binding.prepare("SELECT id, userId, platform, token, locale FROM push_device ORDER BY id").all()).results ?? [];

  ok("the endpoint is public", pushEndpoints[0]?.access === "public");

  const signedIn = await register({ id: ID, token: "fcm-1", platform: "android", locale: "pt-BR" }, true);
  eqn("a signed-in device registers", signedIn.status, 200);
  ok("it answers ok", ((await signedIn.json()) as Row)["ok"] === true);
  eq("the row is kept under the account", JSON.stringify(await rows()), JSON.stringify([{ id: ID, userId: "u_ana", platform: "android", token: "fcm-1", locale: "pt-BR" }]));

  await register({ id: ID, token: "fcm-1", platform: "android", locale: "pt-BR" });
  eq("signed out, the same device is untied", String((await rows())[0]?.["userId"] ?? ""), "");

  const reinstalled = "9b2e4c71-0d3a-4f6b-8e15-2a7c9d0f4e38";
  await register({ id: reinstalled, token: "fcm-1", platform: "android", locale: "en" }, true);
  eq("a token moves to the device now holding it", JSON.stringify((await rows()).map((row) => row["id"])), JSON.stringify([reinstalled]));

  const refused: Array<Record<string, unknown>> = [
    { id: "short", token: "t", platform: "android" },
    { id: ID, token: "", platform: "ios" },
    { id: ID, token: "t", platform: "web" },
    { id: ID, token: "t", platform: "ios", locale: "not a tag" },
  ];
  for (const body of refused) eqn(`refused: ${JSON.stringify(body)}`, (await register(body, true)).status, 400);

  const anonymous = await register({ id: ID, token: "fcm-2", platform: "ios", locale: "" });
  eqn("a visitor may register", anonymous.status, 200);
  eq("with no account", String((await rows()).find((row) => row["id"] === ID)?.["userId"] ?? ""), "");

  done();
};

await main();
