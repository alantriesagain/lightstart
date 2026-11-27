// node-only
/**
 * @file Auth as a server contribution: a project declaring `@lightstart/api`
 * and `@lightstart/auth` gets `users`, `auth_codes` and `auth_code_requests`
 * among its server models
 * (so migrations create them), a generated `.light/server.ts` importing the
 * contribution, and a `createServer` answering `/api/auth/*` with sessions
 * resolved, the app's own endpoints and models beside them.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { applySchema } from "@lightstart/light/model/sql-builder";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { App } from "@lightstart/server";
import { toFetch } from "@lightstart/server/fetch";
import { Database } from "@lightstart/sqlite/node";
import { d1Of, type D1Binding } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { serverModels } from "@lightstart/api/node/models.ts";
import { writeServerEntry } from "@lightstart/api/node/server-entry.ts";

interface Entry {
  models: Record<string, ModelSchema>;
  createServer: (options: { db: D1Binding; env: Record<string, unknown> }) => App;
}

type Row = Record<string, unknown>;

const main = async (): Promise<void> => {
  const project = mkdtempSync(join(import.meta.dirname, "tmp-contribute-"));
  const logged: string[] = [];
  const log = console.log;
  try {
    mkdirSync(join(project, "src", "models"), { recursive: true });
    mkdirSync(join(project, "src", "endpoints"), { recursive: true });
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "tiny", type: "module", dependencies: { "@lightstart/api": "workspace:*", "@lightstart/auth": "workspace:*" } }));
    writeFileSync(join(project, "src", "app.js"), 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ name: "tiny", host: "web", stores: { server: { adapter: "api" } } });\n');
    writeFileSync(join(project, "src", "models", "note.js"), 'import { defineModel } from "@lightstart/light/model";\nexport default defineModel("note", { text: { $type: "string" }, owner: { $type: "string" }, $store: "server", $permissions: { read: "owner", create: "owner", ownerField: "owner" } });\n');
    writeFileSync(join(project, "src", "server.js"), 'import { registerAuthHooks } from "@lightstart/auth/server";\nregisterAuthHooks({ onUserDeleted: (id) => { globalThis.__forgotten = id; }, sessionFields: () => ({ plan: "free" }) });\n');
    writeFileSync(join(project, "src", "endpoints", "whoami.js"), 'import { defineEndpoint } from "@lightstart/api/server";\nexport default defineEndpoint({ path: "/api/whoami", access: "auth", handler: ({ caller }) => ({ id: caller.id }) });\n');

    const models = await serverModels(project);
    eq("the server models hold the contributed tables and the app's own", Object.keys(models).sort().join(","), "auth_code_requests,auth_codes,auth_handoffs,note,oauth_accounts,users");

    await writeServerEntry(project);
    const source = readFileSync(join(project, ".light", "server.ts"), "utf8");
    ok("the entry imports auth's contribution", source.includes('from "@lightstart/auth/server/contribute.ts"'));
    ok("and the app's server setup after it", source.indexOf('import "../src/server.js";') > source.indexOf("@lightstart/auth/server/contribute.ts"));

    const entry = (await import(`${pathToFileURL(join(project, ".light", "server.ts")).href}?mtime=${String(Date.now())}`)) as Entry;
    const db = Database.open(":memory:");
    applySchema(db, models);
    console.log = (line: unknown): void => {
      logged.push(String(line));
    };
    const handle = toFetch(entry.createServer({ db: d1Of(db), env: { JWT_SECRET: "a-test-secret-that-is-long-enough-for-hs256" } }));
    const post = (path: string, body: unknown, token?: string): Promise<Response> =>
      handle(new Request(`http://app.test${path}`, { method: "POST", headers: { "content-type": "application/json", ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) }));

    const asked = (await post("/api/auth/otp", { email: "me@example.com" })).status;
    console.log = log;
    eqn("/api/auth/otp answers", asked, 200);
    const code = /(\d{6})/.exec(logged.join("\n"))?.[1] ?? "";
    ok("with no mail key the code goes to the console mailer", code.length === 6);
    const verified = await post("/api/auth/verify", { email: "me@example.com", code });
    eqn("the code signs in", verified.status, 200);
    const session = (await verified.json()) as Row;
    const token = String(session["token"]);

    const who = await handle(new Request("http://app.test/api/whoami", { headers: { authorization: `Bearer ${token}` } }));
    eqn("the app's own endpoint sees the session as its caller", who.status, 200);
    eqn("anonymous it is refused", (await handle(new Request("http://app.test/api/whoami"))).status, 401);
    const note = await post("/api/note", { text: "mine" }, token);
    eqn("an owner model takes a signed-in write", note.status, 201);
    ok("stamped with the session's user", String(((await note.json()) as Row)["owner"]) !== "");
    ok("src/server.js's sessionFields reach the session", (session["user"] as Row)["plan"] === "free");
    eqn("deleting the account answers", (await post("/api/auth/delete", {}, token)).status, 200);
    ok("and runs the onUserDeleted src/server.js registered", typeof Reflect.get(globalThis, "__forgotten") === "string");
  } finally {
    console.log = log;
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
