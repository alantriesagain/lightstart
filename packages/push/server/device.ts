/**
 * @file `POST /api/push-device`: a device saying where its pushes go. The row
 * is kept under the device's own id and tied to the account the request is
 * signed in as, or to nobody when it carries no session, which is how a device
 * that signed out stops receiving that account's pushes. A token another
 * device held moves to this one. Anybody may call, a visitor included; the
 * device id is the only key.
 */

import { HttpError } from "@lightstart/server";
import { defineEndpoint, type D1Like, type Endpoint } from "@lightstart/api/server";

const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;
const LOCALE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;
const PLATFORMS = new Set(["android", "ios"]);
const MAX_TOKEN = 4096;

const UPSERT = `INSERT INTO push_device (id, userId, platform, token, locale, updatedAt) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET userId = excluded.userId, platform = excluded.platform, token = excluded.token, locale = excluded.locale, updatedAt = excluded.updatedAt`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (body: Record<string, unknown>, key: string): string => {
  const value = body[key];
  return typeof value === "string" ? value : String(value ?? "");
};

/**
 * The one push endpoint: `POST /api/push-device` with
 * `{ id, token, platform, locale }`. It refuses a device id that is not 16 to
 * 64 letters, digits, `-` or `_`, an empty token, a platform other than
 * `android` or `ios`, and a locale that is not a language tag, each with a 400.
 */
export const pushDeviceEndpoint = defineEndpoint({
  path: "/api/push-device",
  method: "POST",
  access: "public",
  handler: async ({ body, caller, db }) => {
    const input = isRecord(body) ? body : {};
    const id = textOf(input, "id");
    const token = textOf(input, "token");
    const platform = textOf(input, "platform");
    const locale = textOf(input, "locale");
    if (!DEVICE_ID.test(id)) throw new HttpError(400, "id is 16 to 64 letters, digits, - or _");
    if (token === "" || token.length > MAX_TOKEN) throw new HttpError(400, "token is required");
    if (!PLATFORMS.has(platform)) throw new HttpError(400, "platform is android or ios");
    if (locale !== "" && !LOCALE.test(locale)) throw new HttpError(400, "locale is a language tag");
    const userId = caller?.id ?? "";
    const binding: D1Like = db;
    await binding.batch([
      binding.prepare("DELETE FROM push_device WHERE token = ? AND id <> ?").bind(token, id),
      binding.prepare(UPSERT).bind(id, userId, platform, token, locale, new Date().toISOString()),
    ]);
    return { ok: true };
  },
});

/** The push endpoints an app's server registers beside its own. */
export const pushEndpoints: Endpoint[] = [pushDeviceEndpoint];
