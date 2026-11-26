// node-only
/**
 * @file The submission policy's phases over a local database: what a send
 * accepts and stamps, the per-address and per-kind caps, `single`, the review
 * moves, publishing a model kind into its own table, and taking one down.
 */

import { applySchema, buildInsertSQL, buildUpdateSQL, getJsonFields } from "@lightstart/light/model/sql-builder";
import { Database } from "@lightstart/sqlite/node";
import { d1Of } from "@lightstart/sqlite/d1";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { visitorModels } from "@lightstart/visitor/server";
import { payloadOf } from "../index.ts";
import { moderationModels } from "../server/models.ts";
import { submissionPolicy } from "../server/policy.ts";

import type { D1Like } from "@lightstart/api/server";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { ModerationUser, SubmissionKind, SubmissionRecord } from "../types.ts";

type Row = Record<string, unknown>;

const SUBMISSION = moderationModels["submission"] as ModelSchema;
const JSON_FIELDS = getJsonFields(SUBMISSION);

const place = {
  id: { $type: "string", required: true },
  name: { $type: "string" },
  provenance: { $type: "array" },
  $moderated: { edit: true },
  $permissions: { read: "public", create: "none", write: "none", delete: "none" },
} as unknown as ModelSchema;

const schema: Record<string, ModelSchema> = { ...moderationModels, ...visitorModels, place };

const isResponse = (value: unknown): value is Response => value instanceof Response;

const recordOf = (row: Row): SubmissionRecord => ({
  ...row,
  id: String(row["id"]),
  kind: String(row["kind"] || ""),
  status: String(row["status"] || "") as SubmissionRecord["status"],
  payload: payloadOf(row["payload"]),
  targetType: String(row["targetType"] || ""),
  targetSlug: String(row["targetSlug"] || ""),
  author: String(row["author"] || ""),
  contributorName: String(row["contributorName"] || ""),
  contributorInstagram: String(row["contributorInstagram"] || ""),
  userId: String(row["userId"] || ""),
  url: String(row["url"] || ""),
  objectKey: String(row["objectKey"] || ""),
});

const main = async (): Promise<void> => {
  const database = Database.open(":memory:");
  applySchema(database, schema);
  const db: D1Like = d1Of(database);

  const behaviour: { publish: (id: string) => Promise<unknown>; unpublish: () => Promise<Response | void> } = {
    publish: async () => ({ url: "/x", objectKey: "photos/x.webp", payload: {} }),
    unpublish: async () => undefined,
  };
  const calls: string[] = [];

  const kinds: Record<string, SubmissionKind> = {
    place: {},
    note: { perHour: 2 },
    picky: {
      accept: ({ payload }) => (payload["ok"] === true ? { payload: { ok: true, text: String(payload["text"] || "").trim() } } : { error: "not ok", status: 422 }),
    },
    once: {
      async accept({ payload, user, db: database }) {
        const had = await database.prepare("SELECT count(*) AS n FROM submission WHERE userId = ? AND kind = 'once'").bind(user.id).first();
        if (Number(had?.["n"] || 0) > 0) return { error: "one each", status: 409 };
        return { payload: { ...payload, owner: user.id } };
      },
    },
    report: { terminal: true },
    photo: {
      single: true,
      async publish({ submission }) {
        calls.push(`publish:${submission.id}`);
        return behaviour.publish(submission.id) as Promise<{ url: string; objectKey: string; payload: Row }>;
      },
      async unpublish() {
        calls.push("unpublish");
        return behaviour.unpublish();
      },
    },
  };
  const policy = submissionPolicy({ kinds, moderated: { place: { edit: true } } });

  let address = 0;
  const send = async (kind: string, payload: unknown, user: ModerationUser | null = { id: "alice" }, ip = `198.51.100.${String(address++)}`): Promise<{ status: number; id?: string }> => {
    const author = payload !== null && typeof payload === "object" && !Array.isArray(payload) ? (payload as Row)["author"] : undefined;
    const answer = await policy.beforeCreate({ data: { kind, payload, ...(author === undefined ? {} : { author }) }, user, request: new Request("https://app.test/api/moderation/submit", { method: "POST", headers: { "user-agent": "node-test" } }), db, env: {}, ip });
    if (isResponse(answer)) return { status: answer.status };
    const query = buildInsertSQL("submission", answer, JSON_FIELDS);
    await db.prepare(query.sql).bind(...query.params).run();
    return { status: 201, id: String(answer["id"]) };
  };
  const rowOf = (id: string): Promise<Row | null> => db.prepare("SELECT * FROM submission WHERE id = ?").bind(id).first();
  const review = async (id: string, data: Row, user: ModerationUser = { id: "admin", admin: true }): Promise<{ status: number; body: Row }> => {
    const found = await rowOf(id);
    const answer = await policy.beforeUpdate({ data, record: found === null ? null : recordOf(found), user, request: new Request("https://app.test", { method: "PATCH" }), db, env: {} });
    if (isResponse(answer)) return { status: answer.status, body: {} };
    const patch: Row = {};
    for (const field of ["status", "payload", "url", "objectKey", "targetSlug"] as const) {
      if (data[field] !== undefined) patch[field] = data[field];
      if (answer[field] !== undefined) patch[field] = answer[field];
    }
    if (Object.keys(patch).length > 0) {
      const update = buildUpdateSQL("submission", id, patch, JSON_FIELDS);
      await db.prepare(update.sql).bind(...update.params).run();
    }
    return { status: 200, body: { ...(await rowOf(id)) } };
  };

  // sending
  eqn("signed out, a send is refused", (await send("place", {}, null)).status, 401);
  eqn("a kind the project does not have is refused", (await send("guide", {})).status, 400);
  eqn("a payload that is not an object is refused", (await send("place", [1, 2])).status, 400);
  eqn("a payload over the size is refused", (await send("place", { text: "x".repeat(40_000) })).status, 413);
  eqn("a kind's refusal keeps its status", (await send("picky", { ok: false })).status, 422);
  const kept = await send("picky", { ok: true, text: "  hi  ", extra: 1 });
  eqn("a kind keeps what it accepts", kept.status, 201);
  eq("with its payload as the kind answered", String((rowOf(kept.id ?? "") !== null ? payloadOf((await rowOf(kept.id ?? ""))?.["payload"]) : {}).text), "hi");

  const once = await send("once", { n: 1 });
  eqn("a kind may read the database in accept", once.status, 201);
  eq("and is handed the sender", String(payloadOf((await rowOf(once.id ?? ""))?.["payload"]).owner), "alice");
  eqn("its own rule can refuse a second", (await send("once", { n: 2 })).status, 409);
  eqn("somebody else is counted apart", (await send("once", { n: 1 }, { id: "bob" })).status, 201);

  const stamped = await send("place", { id: "mine", name: "Arpoador", status: "published", userId: "mallory", url: "https://evil.test", objectKey: "x", ipHash: "forged", author: "a".repeat(500) }, { id: "alice" });
  const stored = (await rowOf(stamped.id ?? "")) ?? {};
  ok("the id is minted by the server", String(stored["id"]).length === 20);
  eq("the status is pending", String(stored["status"]), "pending");
  eq("the sender is the caller", String(stored["userId"]), "alice");
  eq("the url is not the request's", String(stored["url"]), "");
  eq("the objectKey is not the request's", String(stored["objectKey"]), "");
  ok("the ipHash is not the request's", String(stored["ipHash"]) !== "forged");
  eq("the browser is kept", String(stored["ua"]), "node-test");
  eqn("a text column is trimmed to 200", String(stored["author"]).length, 200);

  for (let index = 0; index < 8; index++) eqn(`a person sends ${String(index + 1)}`, (await send("place", {}, { id: `p${String(index)}` }, "203.0.113.9")).status, 201);
  eqn("one address is capped at eight a minute", (await send("place", {}, { id: "p9" }, "203.0.113.9")).status, 429);

  eqn("a kind's first hourly send is taken", (await send("note", {}, { id: "n1" })).status, 201);
  eqn("its second too", (await send("note", {}, { id: "n1" })).status, 201);
  eqn("its third in the hour is refused", (await send("note", {}, { id: "n1" })).status, 429);
  eqn("somebody else has their own cap", (await send("note", {}, { id: "n2" })).status, 201);
  eqn("another kind is not capped by it", (await send("place", {}, { id: "n2" })).status, 201);

  const firstPhoto = await send("photo", { image: "one" }, { id: "c1" });
  const secondPhoto = await send("photo", { image: "two" }, { id: "c1" });
  eq("a single kind replaces the older pending one", String((await rowOf(firstPhoto.id ?? ""))?.["status"]), "replaced");
  eq("which keeps nothing it was sent", String((await rowOf(firstPhoto.id ?? ""))?.["payload"]), "{}");
  eq("the newer one waits", String((await rowOf(secondPhoto.id ?? ""))?.["status"]), "pending");

  await db.prepare("INSERT INTO submission (id, kind, status, userId, updated) VALUES ('old', 'photo', 'replaced', 'c1', datetime('now', '-2 days'))").run();
  await send("place", {}, { id: "sweep" });
  ok("a replaced row older than a day is swept", (await rowOf("old")) === null);

  // reviewing
  eqn("a non-admin changes nothing", (await review(stamped.id ?? "", { status: "approved" }, { id: "alice" })).status, 403);
  const approved = await review(stamped.id ?? "", { status: "approved" });
  eqn("the admin approves a model kind", approved.status, 200);
  eq("and it is published", String(approved.body["status"]), "published");
  const published = await db.prepare("SELECT * FROM place WHERE id = ?").bind("mine").first();
  ok("the row is in the model's table", published !== null);
  eq("with its fields", String(published?.["name"] ?? ""), "Arpoador");
  ok("and carries a provenance hash", (JSON.parse(String(published?.["provenance"] ?? "[]")) as unknown[]).length === 1);
  eq("the review moved the row", String((await rowOf(stamped.id ?? ""))?.["targetSlug"]), "mine");

  eqn("a published one is final", (await review(stamped.id ?? "", { status: "rejected" })).status, 409);
  eqn("a published one is not edited", (await review(stamped.id ?? "", { payload: { name: "x" } })).status, 409);

  const terminal = await send("report", { reason: "spam" });
  eqn("a terminal kind approves", (await review(terminal.id ?? "", { status: "approved" })).status, 200);
  eq("and ends there", String((await rowOf(terminal.id ?? ""))?.["status"]), "approved");

  const again = await send("photo", { image: "one" }, { id: "c2" });
  behaviour.publish = async () => new Response(JSON.stringify({ error: "no storage" }), { status: 503 });
  eqn("a publish that refuses keeps its status", (await review(again.id ?? "", { status: "approved" })).status, 503);
  eq("and leaves the row as it was", String((await rowOf(again.id ?? ""))?.["status"]), "pending");
  behaviour.publish = async () => {
    throw new Error("bucket down");
  };
  const failed = await review(again.id ?? "", { status: "approved" });
  eqn("a publish that throws is a bad gateway", failed.status, 502);
  eq("and the row still waits", String((await rowOf(again.id ?? ""))?.["status"]), "pending");
  behaviour.publish = async () => ({ url: "/a", objectKey: "a", payload: {} });
  await review(again.id ?? "", { status: "approved" });

  const another = await send("photo", { image: "three" }, { id: "c2" });
  await review(another.id ?? "", { status: "approved" });
  eq("a newer single publish takes the older one down", String((await rowOf(again.id ?? ""))?.["status"]), "replaced");
  ok("through the kind's unpublish", calls.filter((call) => call === "unpublish").length >= 1);

  const note = await send("note", {}, { id: "moves" });
  eqn("a review can reject before publishing", (await review(note.id ?? "", { status: "rejected" })).status, 200);
  eqn("and re-approve", (await review(note.id ?? "", { status: "approved" })).status, 200);
  eqn("and go back to pending", (await review(note.id ?? "", { status: "pending" })).status, 200);
  eqn("a review cannot publish by hand", (await review(note.id ?? "", { status: "published" })).status, 409);

  // removing
  const refused = await policy.beforeRemove({ record: recordOf((await rowOf(stamped.id ?? "")) ?? {}), user: { id: "alice" }, request: new Request("https://app.test"), db, env: {} });
  eqn("a non-admin removes nothing", isResponse(refused) ? refused.status : 0, 403);
  await policy.beforeRemove({ record: recordOf((await rowOf(stamped.id ?? "")) ?? {}), user: { id: "admin", admin: true }, request: new Request("https://app.test"), db, env: {} });
  ok("removing a published model kind deletes its row", (await db.prepare("SELECT id FROM place WHERE id = ?").bind("mine").first()) === null);

  done();
};

await main();
