/**
 * @file The rules a submission is written and reviewed under, built from the
 * kinds a project accepts. The package's endpoints call its phases:
 *
 *     const policy = submissionPolicy({ kinds: { place: {}, report: { terminal: true } } });
 *
 * - Sending: a signed-in caller, a kind the project accepts (or a server model
 *   the project has), a payload that kind accepts and that fits its size, a
 *   per-address cap and the kind's own hourly cap per person. The server
 *   stamps the id, the status, the sender, the hashed address and the browser,
 *   whatever the request says, and answers the id alone: the queue is
 *   write-only for a client. A kind marked `single` keeps one waiting
 *   submission per person: sending another replaces the older pending or
 *   rejected one and drops its payload. A kind that is a moderated model is
 *   sent by writing the model; an edit of a published row arrives as
 *   `<model>.edit` with the patch as payload.
 * - Reviewing: the admin only. Pending goes to approved or rejected, and
 *   either can be taken back until it is published. A kind with `publish` goes
 *   public at approval; a kind naming a server model publishes into that
 *   model's table, with the row encoded as `crudApp` encodes it and a
 *   provenance hash the sender's device can heal on; every other kind waits,
 *   approved. A kind marked `terminal` ends at its review.
 * - Removing: the admin only. A published submission is taken down first: a
 *   kind's `unpublish`, or the model row it published.
 *
 * A rejection tells the sender nothing, and their row keeps its payload.
 */

import { registeredKind } from "./kinds.ts";
import { perAddress } from "@lightstart/visitor/server";
import { buildInsertSQL, buildUpdateSQL } from "@lightstart/light/model/sql-builder";

import { REVIEW_MOVES, mintSubmissionId, payloadOf, provenanceOf } from "../index.ts";

import type { D1Like } from "@lightstart/api/server";
import type {
  SubmissionCreateContext,
  SubmissionKind,
  SubmissionPolicy,
  SubmissionPolicyOptions,
  SubmissionPublishContext,
  SubmissionPublished,
  SubmissionRecord,
  SubmissionReviewContext,
  SubmissionStatus,
} from "../types.ts";

const PER_ADDRESS_MINUTE = 8;
const MAX_PAYLOAD = 32_000;
const TEXT_MAX = 200;
const TEXT_FIELDS = ["targetType", "targetSlug", "author", "contributorName", "contributorInstagram"];
const FINAL = new Set<string>(["published", "replaced"]);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const quote = (name: string): string => `"${name.replace(/"/g, '""')}"`;

const count = async (db: D1Like, sql: string, ...params: unknown[]): Promise<number> => Number((await db.prepare(sql).bind(...params).first())?.["n"] || 0);

/** A stored row as the policy reads it. */
const recordOf = (row: SubmissionRecord | Record<string, unknown>): SubmissionRecord => ({
  ...(row as Record<string, unknown>),
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

/** Whether a table exists in the database; a kind's name is checked before it is put in a statement. */
const tableExists = async (db: D1Like, table: string): Promise<boolean> => {
  if (!IDENTIFIER.test(table)) return false;
  const found = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(table).first();
  return found !== null;
};

/** The model a submission writes: its kind, or the target of a `<model>.edit`. */
/**
 * The moderated model a kind publishes into, or null: `place` and `place.edit`
 * name the `place` model, only when it declares `$moderated` (and, for an
 * edit, `edit: true`). The kind alone decides; a sender's `targetType` never
 * names the table.
 */
export const moderatedModelOf = (kind: string, moderated: Record<string, { edit: boolean }>): string | null => {
  const edit = kind.endsWith(".edit");
  const model = edit ? kind.slice(0, -5) : kind;
  const declared = Object.hasOwn(moderated, model) ? moderated[model] : undefined;
  if (declared === undefined) return null;
  return edit && !declared.edit ? null : model;
};

/**
 * Publishes a model kind into its table: an add inserts the payload as a row,
 * an edit patches the row `targetSlug` names. The row is encoded as `crudApp`
 * encodes it (objects as JSON text, booleans as 1 or 0) and carries the
 * submission's provenance, which is what heals the sender's pending row.
 * Answers null when `kind` names no table.
 */
const publishModel = async (db: D1Like, record: SubmissionRecord, moderated: Record<string, { edit: boolean }>): Promise<SubmissionPublished | null> => {
  const table = moderatedModelOf(record.kind, moderated);
  if (table === null || !(await tableExists(db, table))) return null;
  const provenance = await provenanceOf(record.id);
  const columns = new Set(((await db.prepare(`PRAGMA table_info(${quote(table)})`).all()).results ?? []).map((row) => String(row["name"])));
  const jsonFields = new Set<string>();

  if (record.kind.endsWith(".edit")) {
    const target = String(record.targetSlug || "");
    const existing = target === "" ? null : await db.prepare(`SELECT * FROM ${quote(table)} WHERE id = ?`).bind(target).first();
    if (existing === null) throw new Error(`the row ${table}/${target} is not there to edit`);
    const data: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(record.payload)) {
      if (field === "id" || field === "created" || field === "updated" || field === "pending" || !columns.has(field)) continue;
      if (value !== null && typeof value === "object") jsonFields.add(field);
      data[field] = value;
    }
    if (columns.has("provenance")) {
      const current = Array.isArray(existing["provenance"]) ? existing["provenance"].map(String) : [];
      data["provenance"] = [...new Set([...current, provenance])];
      jsonFields.add("provenance");
    }
    const query = buildUpdateSQL(table, target, data, jsonFields);
    await db.prepare(query.sql).bind(...query.params).run();
    return { payload: record.payload, targetSlug: target };
  }

  const data: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(record.payload)) {
    if (field === "pending" || !columns.has(field)) continue;
    if (value !== null && typeof value === "object") jsonFields.add(field);
    data[field] = value;
  }
  if (data["id"] === undefined || data["id"] === null) data["id"] = crypto.randomUUID();
  if (columns.has("provenance")) {
    const current = Array.isArray(data["provenance"]) ? (data["provenance"] as unknown[]).map(String) : [];
    data["provenance"] = [...new Set([...current, provenance])];
    jsonFields.add("provenance");
  }
  const query = buildInsertSQL(table, data, jsonFields);
  await db.prepare(query.sql).bind(...query.params).run();
  return { payload: record.payload, targetSlug: String(data["id"]) };
};

/** The published row a model submission left, deleted; a no-op for a kind that is no model. */
const unpublishModel = async (db: D1Like, record: SubmissionRecord, moderated: Record<string, { edit: boolean }>): Promise<void> => {
  const table = moderatedModelOf(record.kind, moderated);
  if (table === null || !(await tableExists(db, table))) return;
  const target = String(record.targetSlug || record.payload["id"] || "");
  if (target === "") return;
  await db.prepare(`DELETE FROM ${quote(table)} WHERE id = ?`).bind(target).run();
};

/** Takes a published submission down through the kind's `unpublish`, or the model row it published. */
const takeDown = async (def: SubmissionKind | null | undefined, ctx: SubmissionPublishContext, moderated: Record<string, { edit: boolean }>): Promise<Response | void> => {
  if (def?.unpublish !== undefined) {
    const refused = await def.unpublish(ctx);
    if (refused instanceof Response) return refused;
    return undefined;
  }
  await unpublishModel(ctx.db, ctx.submission, moderated);
  return undefined;
};

/**
 * The rules for a project's submissions.
 */
export const submissionPolicy = ({ kinds, moderated = {}, perAddress: addressMax = PER_ADDRESS_MINUTE }: SubmissionPolicyOptions): SubmissionPolicy => {
  const kindOf = (kind: string): SubmissionKind | null => (Object.hasOwn(kinds, kind) ? (kinds[kind] ?? null) : registeredKind(kind));

  /**
   * A newer submission of a `single` kind was just published, so the older
   * published ones of the same person go down. One that cannot be taken down
   * stays published, so the next approval or the account's deletion tries
   * again rather than leaving something public that no row names.
   */
  const retire = async (def: SubmissionKind, { submission, db, env, request }: SubmissionPublishContext): Promise<void> => {
    const result = await db
      .prepare("SELECT * FROM submission WHERE userId = ? AND kind = ? AND status = 'published' AND id != ?")
      .bind(submission.userId, submission.kind, submission.id)
      .all();
    for (const row of result.results ?? []) {
      try {
        const refused = await takeDown(def, { submission: recordOf(row), db, env, request }, moderated);
        if (refused instanceof Response) throw new Error(`refused with ${refused.status}`);
        await db
          .prepare("UPDATE submission SET status = 'replaced', payload = '{}', url = '', objectKey = '', updated = datetime('now') WHERE id = ?")
          .bind(row["id"])
          .run();
      } catch (error) {
        console.warn("[moderation] an older one stays published until it can be taken down", row["id"], reason(error));
      }
    }
  };

  return {
    async beforeCreate({ data, user, db, env, ip, request }: SubmissionCreateContext): Promise<Record<string, unknown> | Response> {
      if (user === null) return json({ error: "sign in first" }, 401);
      const kind = String(data["kind"] || "").trim();
      const def = kindOf(kind);
      if (def === null && moderatedModelOf(kind, moderated) === null) return json({ error: "invalid kind" }, 400);
      const sent = data["payload"] ?? {};
      if (sent === null || typeof sent !== "object" || Array.isArray(sent)) return json({ error: "invalid payload" }, 400);
      if (JSON.stringify(sent).length > (def?.maxPayload ?? MAX_PAYLOAD)) return json({ error: "too large" }, 413);
      let payload = sent as Record<string, unknown>;
      if (def?.accept !== undefined) {
        const verdict = await def.accept({ payload, user, request, db, env });
        if ("error" in verdict) return json({ error: verdict.error }, verdict.status ?? 400);
        payload = verdict.payload;
      }

      const { ipHash, limited } = await perAddress(db, "submission", { env, ip: ip ?? null, max: addressMax });
      if (limited) return json({ error: "rate limited" }, 429);
      const userId = String(user.id || "");
      if (def?.perHour !== undefined && (await count(db, "SELECT count(*) AS n FROM submission WHERE userId = ? AND kind = ? AND created > datetime('now', '-1 hour')", userId, kind)) >= def.perHour)
        return json({ error: "rate limited" }, 429);

      if (def?.single === true)
        await db
          .prepare("UPDATE submission SET status = 'replaced', payload = '{}', updated = datetime('now') WHERE userId = ? AND kind = ? AND status IN ('pending', 'rejected')")
          .bind(userId, kind)
          .run();
      await db.prepare("DELETE FROM submission WHERE status = 'replaced' AND updated < datetime('now', '-1 day')").run();

      const text = Object.fromEntries(TEXT_FIELDS.map((field) => [field, String(data[field] ?? "").trim().slice(0, TEXT_MAX)]));
      return {
        ...text,
        id: mintSubmissionId(),
        kind,
        payload,
        status: "pending",
        userId,
        url: "",
        objectKey: "",
        ipHash,
        ua: (request.headers.get("user-agent") || "").slice(0, 200),
      };
    },

    async beforeUpdate({ data, record, user, db, env, request }: SubmissionReviewContext): Promise<Record<string, unknown> | Response> {
      if (user === null || user.admin !== true) return json({ error: "only a review changes a submission" }, 403);
      if (record === null) return json({ error: "not found" }, 404);
      const from = String(record.status || "");
      const to = data["status"] === undefined ? from : String(data["status"]);
      if (FINAL.has(from)) return to === from && data["payload"] === undefined ? {} : json({ error: `a ${from} submission is taken down, not changed` }, 409);
      if (to !== from && !REVIEW_MOVES[from]?.includes(to)) return json({ error: `a ${from} submission cannot become ${to}` }, 409);

      const def = kindOf(record.kind);
      if (to !== "approved" || from === "approved") return {};

      const submission = recordOf({ ...record, payload: data["payload"] ?? record.payload });
      try {
        if (def !== null && def.publish !== undefined) {
          const published = await def.publish({ submission, db, env, request });
          if (published instanceof Response) return published;
          if (def.single === true) await retire(def, { submission, db, env, request });
          return { status: "published", url: published.url ?? "", objectKey: published.objectKey ?? "", payload: published.payload ?? submission.payload, ...(published.targetSlug === undefined ? {} : { targetSlug: published.targetSlug }) };
        }
        if (def?.terminal === true) return {};
        const published = await publishModel(db, submission, moderated);
        if (published !== null) return { status: "published", ...published };
        return {};
      } catch (error) {
        return json({ error: `publishing failed: ${reason(error)}` }, 502);
      }
    },

    async beforeRemove({ record, user, db, env, request }: Omit<SubmissionReviewContext, "data">): Promise<Response | void> {
      if (user === null || user.admin !== true) return json({ error: "only a review removes a submission" }, 403);
      if (record === null || record.status !== "published") return undefined;
      const def = kindOf(record.kind);
      try {
        return await takeDown(def, { submission: recordOf(record), db, env, request }, moderated);
      } catch (error) {
        return json({ error: `taking it down failed: ${reason(error)}` }, 502);
      }
    },
  };
};

