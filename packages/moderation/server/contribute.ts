/**
 * @file What `@lightstart/moderation` adds to an app's server, declared in its
 * `package.json` (`light.server`): the `submission` and `moderation_avatars`
 * tables, the `visits` table the per-address limit counts, and the endpoints a
 * person submits through and the admin reviews with.
 *
 * A project that needs kinds of its own (a report, a claim) calls
 * `moderationEndpoints({ kinds })` with `submissionPolicy`'s kinds; the
 * default accepts every kind that names a server model and the shipped
 * `avatar` kind.
 */

import { defineEndpoint, defineServerContribution, type Caller, type D1Like, type Endpoint } from "@lightstart/api/server";
import { decodeRow } from "@lightstart/light/model/sql";
import { buildDeleteSQL, buildInsertSQL, buildSelectSQL, buildUpdateSQL, getJsonFields } from "@lightstart/light/model/sql-builder";
import { visitorModels } from "@lightstart/visitor/server";

import { payloadOf } from "../index.ts";
import { avatar } from "./avatar.ts";
import { moderationModels } from "./models.ts";
import { submissionPolicy } from "./policy.ts";
import { serveFile } from "./serve-file.ts";
import { storageOf } from "./storage.ts";

import type { ModelSchema } from "@lightstart/light/model/types.ts";
import type { SubmissionKind, SubmissionRecord, SubmissionStatus } from "../types.ts";

type Row = Record<string, unknown>;

const SUBMISSION_SCHEMA = moderationModels["submission"] as ModelSchema;
const JSON_FIELDS = getJsonFields(SUBMISSION_SCHEMA);
const STATUSES = new Set<string>(["pending", "approved", "published", "rejected", "replaced"]);

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

const recordOf = (row: Row): SubmissionRecord => ({
  ...row,
  id: String(row["id"]),
  kind: String(row["kind"] || ""),
  status: String(row["status"] || "") as SubmissionStatus,
  payload: payloadOf(row["payload"]),
  targetType: String(row["targetType"] || ""),
  targetSlug: String(row["targetSlug"] || ""),
  author: String(row["author"] || ""),
  contributorName: String(row["contributorName"] || ""),
  contributorInstagram: String(row["contributorInstagram"] || ""),
  userId: String(row["userId"] || ""),
  url: String(row["url"] || ""),
  objectKey: String(row["objectKey"] || ""),
  ua: String(row["ua"] || ""),
  ipHash: String(row["ipHash"] || ""),
});

const decodeSubmission = (row: Row): Row => {
  const decoded = decodeRow(SUBMISSION_SCHEMA, row);
  return { ...decoded, payload: payloadOf(decoded["payload"]) };
};

const insertSubmission = async (db: D1Like, row: Row): Promise<void> => {
  const query = buildInsertSQL("submission", row, JSON_FIELDS);
  await db.prepare(query.sql).bind(...query.params).run();
};

const updateSubmission = async (db: D1Like, id: string, patch: Row): Promise<Row | null> => {
  if (Object.keys(patch).length === 0) return db.prepare("SELECT * FROM submission WHERE id = ?").bind(id).first();
  const query = buildUpdateSQL("submission", id, patch, JSON_FIELDS);
  await db.prepare(query.sql).bind(...query.params).run();
  return db.prepare("SELECT * FROM submission WHERE id = ?").bind(id).first();
};

const numberParam = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : undefined;
};

/** The IP a per-address cap counts, if the host forwarded one. */
const ipOf = (request: Request): string | null => request.headers.get("cf-connecting-ip");

/**
 * The moderation endpoints over the kinds given. Registered by the package's
 * server contribution; a project with kinds of its own builds its own list.
 */
/** The server models that declare `$moderated`, each with whether an edit may be submitted (`$moderated: { edit: true }`). */
export const moderatedOf = (models: Record<string, ModelSchema>): Record<string, { edit: boolean }> => {
  const out: Record<string, { edit: boolean }> = {};
  for (const [name, schema] of Object.entries(models)) {
    const declared: unknown = Reflect.get(schema, "$moderated");
    if (declared === undefined || declared === false || declared === null) continue;
    const edit = typeof declared === "object" && Reflect.get(declared, "edit") === true;
    out[name] = { edit };
  }
  return out;
};

export const moderationEndpoints = ({ kinds = {} as Record<string, SubmissionKind>, models = {} as Record<string, ModelSchema> } = {}): Endpoint[] => {
  const allKinds: Record<string, SubmissionKind> = { ...kinds, avatar };
  const policy = submissionPolicy({ kinds: allKinds, moderated: moderatedOf(models) });

  return [
    defineEndpoint({
      path: "/api/moderation/submit",
      method: "POST",
      access: "auth",
      handler: async ({ request, body, caller, db, env }) => {
        if (!isRecord(body)) return json({ error: "expected a JSON object" }, 400);
        const answer = await policy.beforeCreate({ data: body, user: caller as Caller & { id: string }, request, db, env, ip: ipOf(request) });
        if (answer instanceof Response) return answer;
        await insertSubmission(db, answer);
        return json({ id: String(answer["id"]) }, 201);
      },
    }),

    defineEndpoint({
      path: "/api/moderation/pending",
      method: "GET",
      access: "admin",
      handler: async ({ query, db }) => {
        const where: Row = {};
        const status = query["status"] ?? "pending";
        if (!STATUSES.has(status)) return json({ error: "invalid status" }, 400);
        where["status"] = status;
        if (query["kind"] !== undefined && query["kind"] !== "") where["kind"] = query["kind"];
        const limit = numberParam(query["limit"]);
        const offset = numberParam(query["offset"]);
        const select = buildSelectSQL("submission", { where, order: [{ field: "created", direction: "ASC" }], ...(limit === undefined ? {} : { limit }), ...(offset === undefined ? {} : { offset }) });
        const result = await db.prepare(select.sql).bind(...select.params).all();
        const rows = (result.results ?? []).map(decodeSubmission);
        return json({ rows });
      },
    }),

    defineEndpoint({
      path: "/api/moderation/mine",
      method: "GET",
      access: "auth",
      handler: async ({ query, caller, db }) => {
        const status = query["status"] ?? "pending";
        if (!STATUSES.has(status)) return json({ error: "invalid status" }, 400);
        const select = buildSelectSQL("submission", { where: { userId: (caller as Caller & { id: string }).id, status }, order: [{ field: "created", direction: "ASC" }] });
        const result = await db.prepare(select.sql).bind(...select.params).all();
        return json({ rows: (result.results ?? []).map(decodeSubmission) });
      },
    }),

    defineEndpoint({
      path: "/api/moderation/submissions/:id",
      method: "PATCH",
      access: "admin",
      handler: async ({ params, body, caller, db, env, request }) => {
        if (!isRecord(body)) return json({ error: "expected a JSON object" }, 400);
        const found = await db.prepare("SELECT * FROM submission WHERE id = ?").bind(params["id"] ?? "").first();
        if (found === null) return json({ error: "not found" }, 404);
        const record = recordOf(found);
        const answer = await policy.beforeUpdate({ data: body, record, user: caller as Caller & { id: string }, request, db, env });
        if (answer instanceof Response) return answer;
        const patch: Row = {};
        for (const field of ["status", "payload", "url", "objectKey", "targetSlug"] as const) {
          if (body[field] !== undefined) patch[field] = body[field];
          if (answer[field] !== undefined) patch[field] = answer[field];
        }
        if (typeof patch["status"] === "string" && !STATUSES.has(patch["status"])) return json({ error: "invalid status" }, 400);
        const updated = await updateSubmission(db, record.id, patch);
        return json(decodeSubmission(updated ?? found));
      },
    }),

    defineEndpoint({
      path: "/api/moderation/submissions/:id",
      method: "DELETE",
      access: "admin",
      handler: async ({ params, caller, db, env, request }) => {
        const found = await db.prepare("SELECT * FROM submission WHERE id = ?").bind(params["id"] ?? "").first();
        if (found === null) return json({ error: "not found" }, 404);
        const refused = await policy.beforeRemove({ record: recordOf(found), user: caller as Caller & { id: string }, request, db, env });
        if (refused instanceof Response) return refused;
        const query = buildDeleteSQL("submission", String(found["id"]));
        await db.prepare(query.sql).bind(...query.params).run();
        return json({ deleted: true });
      },
    }),

    defineEndpoint({
      path: "/api/files/*",
      method: "GET",
      access: "public",
      handler: async ({ request, env }) => {
        const storage = storageOf(env);
        if (storage === null) return json({ error: "not found" }, 404);
        return serveFile({ storage, request });
      },
    }),

    defineEndpoint({
      path: "/api/files/*",
      method: "HEAD",
      access: "public",
      handler: async ({ request, env }) => {
        const storage = storageOf(env);
        if (storage === null) return json({ error: "not found" }, 404);
        return serveFile({ storage, request });
      },
    }),
  ];
};

/** The server contribution `light.server` names. */
export default defineServerContribution({
  models: { ...moderationModels, ...visitorModels },
  endpoints: (_env, models) => moderationEndpoints({ models }),
});
