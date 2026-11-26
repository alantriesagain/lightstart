// node-only
/**
 * @file Moderation as a server contribution: a project declaring
 * `@lightstart/api`, `@lightstart/auth` and `@lightstart/moderation` gets the
 * submission tables, the submit, pending, mine and review endpoints, and an
 * approval that publishes a moderated model's row into its own table.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
    mkdirSync(join(project, "node_modules", "@lightstart"), { recursive: true });
    symlinkSync(join(import.meta.dirname, ".."), join(project, "node_modules", "@lightstart", "moderation"), "dir");
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "tiny", type: "module", dependencies: { "@lightstart/api": "workspace:*", "@lightstart/auth": "workspace:*", "@lightstart/moderation": "workspace:*" } }));
    writeFileSync(join(project, "src", "app.js"), 'import { defineApp } from "@lightstart/app";\nexport default defineApp({ name: "tiny", host: "web", stores: { server: { adapter: "api" } } });\n');
    writeFileSync(
      join(project, "src", "server.js"),
      'import { registerSubmissionKinds } from "@lightstart/moderation/server";\nregisterSubmissionKinds({ tip: { terminal: true } });\n',
    );
    writeFileSync(
      join(project, "src", "models", "place.js"),
      'import { defineModel } from "@lightstart/light/model";\nexport default defineModel("place", { name: { $type: "string" }, provenance: { $type: "array" }, $moderated: { edit: true }, $store: "server", $permissions: { read: "public", create: "none", write: "none", delete: "none" } });\n',
    );

    const models = await serverModels(project);
    eq("the server models hold the contributed tables and the app's own", Object.keys(models).sort().join(","), "auth_codes,moderation_avatars,place,submission,users,visits");

    await writeServerEntry(project);
    const source = readFileSync(join(project, ".light", "server.ts"), "utf8");
    ok("the entry imports moderation's contribution", source.includes('from "@lightstart/moderation/server/contribute.ts"'));

    const entry = (await import(`${pathToFileURL(join(project, ".light", "server.ts")).href}?mtime=${String(Date.now())}`)) as Entry;
    const db = Database.open(":memory:");
    applySchema(db, models);
    console.log = (line: unknown): void => {
      logged.push(String(line));
      if (/^(ok|FAIL|PASS) /.test(String(line))) log(line);
    };
    const d1 = d1Of(db);
    const handle = toFetch(entry.createServer({ db: d1, env: { JWT_SECRET: "a-test-secret-that-is-long-enough-for-hs256" } }));

    const call = async (method: string, path: string, body?: unknown, token?: string): Promise<Response> =>
      handle(
        new Request(`http://app.test${path}`, {
          method,
          headers: { "content-type": "application/json", ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );

    const signIn = async (email: string): Promise<{ token: string; id: string }> => {
      logged.length = 0;
      const asked = await call("POST", "/api/auth/otp", { email });
      eqn(`${email}: the code is mailed`, asked.status, 200);
      const code = /(\d{6})/.exec(logged.join("\n"))?.[1] ?? "";
      const verified = await call("POST", "/api/auth/verify", { email, code });
      eqn(`${email}: the code signs in`, verified.status, 200);
      const body = (await verified.json()) as Row;
      const user = body["user"] as Row;
      return { token: String(body["token"]), id: String(user["id"]) };
    };

    const alice = await signIn("alice@example.com");
    const bob = await signIn("bob@example.com");
    await d1.prepare("UPDATE users SET admin = 1 WHERE id = ?").bind(bob.id).run();

    const sent = await call("POST", "/api/moderation/submit", { kind: "place", payload: { id: "place-1", name: "Arpoador" } }, alice.token);
    eqn("a signed-in person submits", sent.status, 201);
    const sentBody = (await sent.json()) as Row;
    const first = String(sentBody["id"]);
    ok("the submit answers the id alone", Object.keys(sentBody).join(",") === "id" && first.length === 20);
    eqn("signed out, a submission is refused", (await call("POST", "/api/moderation/submit", { kind: "place", payload: {} })).status, 401);
    eqn("a kind the project does not have is refused", (await call("POST", "/api/moderation/submit", { kind: "toString", payload: {} }, alice.token)).status, 400);
    eqn("a table that is not $moderated cannot be submitted into (users)", (await call("POST", "/api/moderation/submit", { kind: "users", payload: { id: "evil", email: "evil@example.com", admin: 1 } }, alice.token)).status, 400);
    eqn("nor edited (users.edit)", (await call("POST", "/api/moderation/submit", { kind: "users.edit", targetType: "users", targetSlug: alice.id, payload: { admin: 1 } }, alice.token)).status, 400);
    eqn("nor the code table", (await call("POST", "/api/moderation/submit", { kind: "auth_codes", payload: {} }, alice.token)).status, 400);

    eqn("a non-admin cannot list the queue", (await call("GET", "/api/moderation/pending", undefined, alice.token)).status, 403);
    const pending = await call("GET", "/api/moderation/pending", undefined, bob.token);
    eqn("the admin lists pending", pending.status, 200);
    const pendingRows = ((await pending.json()) as Row)["rows"] as Row[];
    eqn("the pending queue holds the submission", pendingRows.length, 1);
    eq("with its payload read as an object", String((pendingRows[0]?.["payload"] as Row)["name"]), "Arpoador");

    eqn("a non-admin cannot approve", (await call("PATCH", `/api/moderation/submissions/${first}`, { status: "approved" }, alice.token)).status, 403);
    const approved = await call("PATCH", `/api/moderation/submissions/${first}`, { status: "approved" }, bob.token);
    eqn("the admin approves", approved.status, 200);
    eq("and the submission is published", String(((await approved.json()) as Row)["status"]), "published");

    const published = await call("GET", "/api/place/place-1");
    eqn("the approved row is published into its model table", published.status, 200);
    const publishedRow = (await published.json()) as Row;
    eq("with the payload's fields", String(publishedRow["name"]), "Arpoador");
    ok("and a provenance the sender's device heals on", Array.isArray(publishedRow["provenance"]) && (publishedRow["provenance"] as unknown[]).length === 1);

    const second = String((((await (await call("POST", "/api/moderation/submit", { kind: "place", payload: { id: "place-2", name: "Rejected" } }, alice.token)).json()) as Row)["id"]));
    const rejected = await call("PATCH", `/api/moderation/submissions/${second}`, { status: "rejected" }, bob.token);
    eqn("the admin rejects", rejected.status, 200);
    eq("the rejected submission keeps its status", String(((await rejected.json()) as Row)["status"]), "rejected");
    eqn("a rejected row is never published", (await call("GET", "/api/place/place-2")).status, 404);

    const third = String((((await (await call("POST", "/api/moderation/submit", { kind: "place", payload: { id: "place-3", name: "Mine" } }, alice.token)).json()) as Row)["id"]));
    const mine = await call("GET", "/api/moderation/mine", undefined, alice.token);
    eqn("the sender reads their own pending submissions", mine.status, 200);
    const mineRows = ((await mine.json()) as Row)["rows"] as Row[];
    eq("only theirs and only pending", mineRows.map((row) => String(row["id"])).join(","), third);

    const back = await call("PATCH", `/api/moderation/submissions/${third}`, { status: "pending" }, bob.token);
    eqn("a rejected one can be taken back before publishing", back.status, 200);
    eqn("a published one is final", (await call("PATCH", `/api/moderation/submissions/${first}`, { status: "rejected" }, bob.token)).status, 409);

    const tip = await call("POST", "/api/moderation/submit", { kind: "tip", payload: { text: "the beach is lovely at six" } }, alice.token);
    eqn("a kind the app registered in src/server.js is accepted on the one submit route", tip.status, 201);
  } finally {
    console.log = log;
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
