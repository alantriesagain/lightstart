/**
 * @file A person's profile photo as a kind of submission. The photo waits in
 * the row as a data URL `readImageDataUrl` accepted, one per person, five an
 * hour. Approving it puts the file in storage at `avatars/<submission
 * id>.<ext>`, an address that names no account, and points the account's photo
 * at it on the site's own origin (`SITE_ORIGIN`, else the request's).
 *
 * `@lightstart/auth`'s `users` table carries no photo column, so this package
 * keeps the published address in its own `moderation_avatars` table, keyed by
 * the account id. An app that draws a person joins that row (or reads it with
 * `avatarUrl`).
 *
 * The picture a sign-in provider hands over is never shown from the provider's
 * address. `queueProviderAvatar` copies it once, when the account is first
 * linked, into a pending photo reviewed like any other.
 */

import { imageSize } from "@lightstart/images";

import { FILES_PATH, base64Of, mintSubmissionId } from "../index.ts";
import { readImageDataUrl } from "./image.ts";
import { isMediaKey } from "./serve-file.ts";
import { storageOf } from "./storage.ts";

import type { D1Like } from "@lightstart/api/server";
import type { SubmissionKind } from "../types.ts";

const FOLDER = "avatars";
const IMMUTABLE = "public, max-age=31536000, immutable";
const KEPT_SIZE = 512;
const FETCH_MS = 4000;

const json = (body: unknown, status: number): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The `avatar` kind: one waiting photo per person, five an hour. */
export const avatar: SubmissionKind = {
  single: true,
  perHour: 5,
  maxPayload: 201_000,
  accept({ payload, user }) {
    if (user.admin === true) return { error: "only a person sends a photo", status: 403 };
    const image = readImageDataUrl(payload["image"]);
    return image.ok ? { payload: { image: image.dataUrl } } : { error: image.error };
  },
  async publish({ submission, db, env, request }) {
    const storage = storageOf(env);
    if (storage === null) return json({ error: "no storage is bound here, so nothing can be approved" }, 503);
    const image = readImageDataUrl(submission.payload["image"]);
    if (!image.ok) return json({ error: "this photo has no image left to approve" }, 409);
    const userId = String(submission.userId || "");
    if ((await db.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first()) === null) return json({ error: "the person who sent this is gone" }, 410);
    const objectKey = `${FOLDER}/${submission.id}.${image.ext}`;
    if (!isMediaKey(objectKey)) return json({ error: "this submission's id cannot address a file" }, 409);

    await storage.put(objectKey, image.bytes, { httpMetadata: { contentType: image.contentType, cacheControl: IMMUTABLE } });
    const origin = String(env["SITE_ORIGIN"] || "").replace(/\/+$/, "") || new URL(request.url).origin;
    const url = `${origin}${FILES_PATH}${objectKey}`;
    await db.prepare("DELETE FROM moderation_avatars WHERE id = ?").bind(userId).run();
    await db.prepare("INSERT INTO moderation_avatars (id, url, objectKey) VALUES (?, ?, ?)").bind(userId, url, objectKey).run();
    return { url, objectKey, payload: {} };
  },
  async unpublish({ submission, db, env }) {
    const storage = storageOf(env);
    if (storage === null) return json({ error: "no storage is bound here, so the file cannot be taken down" }, 503);
    if (submission.objectKey !== "") await storage.delete(String(submission.objectKey));
    if (submission.url !== "")
      await db.prepare("DELETE FROM moderation_avatars WHERE id = ? AND objectKey = ?").bind(String(submission.userId || ""), String(submission.objectKey)).run();
    return undefined;
  },
};

/**
 * The address of a provider's picture at the size a photo is kept at: a
 * Google one is asked for square at 512px, since it arrives at 96px, which is
 * too small to keep. Any other address is fetched as it is.
 */
export const sizedPicture = (url: string): string => {
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith(".googleusercontent.com")) return url;
  const at = parsed.pathname.lastIndexOf("=");
  parsed.pathname = `${at === -1 ? parsed.pathname : parsed.pathname.slice(0, at)}=s${KEPT_SIZE}-c`;
  return parsed.toString();
};

/**
 * Copies the picture a sign-in provider handed over into a pending photo, for
 * the account's hook to call when the provider account is first linked. It
 * does nothing for a person who has already sent a photo, and nothing when
 * the picture cannot be fetched or is not one `readImageDataUrl` accepts.
 */
export const queueProviderAvatar = async (
  { userId, provider, url }: { userId: string; provider: string; url: string },
  db: D1Like,
  { fetch: get = globalThis.fetch }: { fetch?: typeof fetch } = {},
): Promise<boolean> => {
  if (userId === "" || !/^https:\/\//.test(url)) return false;
  if ((await db.prepare("SELECT id FROM submission WHERE userId = ? AND kind = 'avatar' LIMIT 1").bind(userId).first()) !== null) return false;
  const response = await get(sizedPicture(url), { signal: AbortSignal.timeout(FETCH_MS) }).catch(() => null);
  if (response === null || !response.ok) return false;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = imageSize(bytes)?.type;
  const image = type === undefined ? null : readImageDataUrl(`data:image/${type};base64,${base64Of(bytes)}`);
  if (image === null || !image.ok) return false;
  await db
    .prepare("INSERT INTO submission (id, kind, status, payload, userId, url, objectKey, ipHash, ua) VALUES (?, 'avatar', 'pending', ?, ?, '', '', '', '')")
    .bind(mintSubmissionId(), JSON.stringify({ image: image.dataUrl, from: provider }), userId)
    .run();
  return true;
};
