/**
 * @file Sending a push, on the server, through Firebase Cloud Messaging HTTP v1
 * for both platforms: FCM delivers to Android itself and to iOS through APNs.
 * Android gets a data-only message, so the app decides how to show it and
 * shows one line per id; iOS gets an APNs alert with `id` and `url` beside it.
 * A device whose token FCM calls unregistered, or no token at all, is deleted
 * on the spot; any other refusal leaves it alone. A message may be a function
 * of the device's locale, so the people a push reaches read it in the language
 * each of their devices registered with.
 *
 * The bearer is minted from the service account in `FCM_SERVICE_ACCOUNT_JSON`
 * (its JSON, whose RS256 signature is made with Web Crypto so it runs in a
 * Worker) and messages go to the account's own `project_id`, or to
 * `FCM_PROJECT_ID` when the Firebase project is another one that granted the
 * account the FCM role.
 *
 * Without `FCM_SERVICE_ACCOUNT_JSON` nothing is sent: one `[push:dev]` line is
 * logged per message (per locale, for a function), naming the target and what
 * it says, the way the mailer prints a code on the dev server.
 */

import type { D1Like } from "@lightstart/api/server";
import type { PushDevice, PushEnv, PushMessage, PushMessageFor, PushOutcome, PushTarget } from "../types.ts";

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_LIFETIME_SECONDS = 60 * 60;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id?: string;
}

interface AccessToken {
  token: string;
  expiresAt: number;
}

/** What a caller may inject: a fake FCM for a test, and the clock a token's life is measured by. */
export interface SendOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const tokens = new Map<string, AccessToken>();

/** Forget the cached OAuth tokens; for a test, or a process whose service account changed. */
export const clearTokenCache = (): void => {
  tokens.clear();
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const bytesOf = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

const base64UrlOf = (bytes: Uint8Array): string => {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] as number;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    out += ALPHABET[(value >> 18) & 63] as string;
    out += ALPHABET[(value >> 12) & 63] as string;
    if (second !== undefined) out += ALPHABET[(value >> 6) & 63] as string;
    if (third !== undefined) out += ALPHABET[value & 63] as string;
  }
  return out;
};

const base64UrlOfText = (text: string): string => base64UrlOf(bytesOf(text));

const bytesOfBase64 = (text: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(text);
  const out: Uint8Array<ArrayBuffer> = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) out[index] = binary.charCodeAt(index);
  return out;
};

const derOfPem = (pem: string): Uint8Array<ArrayBuffer> => bytesOfBase64(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The service account `FCM_SERVICE_ACCOUNT_JSON` holds, or null when it is missing or not a key. */
export const serviceAccountOf = (raw: unknown): ServiceAccount | null => {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const client_email = value["client_email"];
    const private_key = value["private_key"];
    if (typeof client_email !== "string" || typeof private_key !== "string") return null;
    if (client_email === "" || private_key === "") return null;
    const project_id = value["project_id"];
    return { client_email, private_key, ...(typeof project_id === "string" ? { project_id } : {}) };
  } catch {
    return null;
  }
};

const assertionOf = async (account: ServiceAccount, now: number): Promise<string> => {
  const header = base64UrlOfText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlOfText(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + TOKEN_LIFETIME_SECONDS,
    }),
  );
  const input = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    derOfPem(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, bytesOf(input));
  return `${input}.${base64UrlOf(new Uint8Array(signature))}`;
};

const accessTokenOf = async (account: ServiceAccount, options: SendOptions): Promise<string> => {
  const now = options.now ?? Date.now;
  const current = now();
  const cacheKey = `${account.client_email}\n${account.private_key}`;
  const cached = tokens.get(cacheKey);
  if (cached !== undefined && cached.expiresAt - 60_000 > current) return cached.token;

  const assertion = await assertionOf(account, Math.floor(current / 1000));
  const body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  const response = await (options.fetchImpl ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const answer: unknown = await response.json().catch(() => null);
  const token = isRecord(answer) ? answer["access_token"] : undefined;
  if (!response.ok || typeof token !== "string" || token === "") throw new Error(`Google refused the service account (${String(response.status)})`);
  const lifetime = isRecord(answer) && typeof answer["expires_in"] === "number" ? answer["expires_in"] : TOKEN_LIFETIME_SECONDS;
  tokens.set(cacheKey, { token, expiresAt: current + lifetime * 1000 });
  return token;
};

const textOf = ({ id, title, body, url }: PushMessage): PushMessage => ({
  id: String(id ?? ""),
  title: String(title ?? ""),
  body: String(body ?? ""),
  url: String(url ?? ""),
});

const fcmMessageOf = (device: PushDevice, { id, title, body, url }: PushMessage): Record<string, unknown> =>
  device.platform === "ios"
    ? { token: device.token, apns: { payload: { aps: { alert: { title, body }, sound: "default" }, id, url } } }
    : { token: device.token, data: { id, title, body, url }, android: { priority: "HIGH" } };

const isDeadToken = (status: number, answer: unknown): boolean => {
  const error = isRecord(answer) && isRecord(answer["error"]) ? answer["error"] : null;
  const details = error !== null && Array.isArray(error["details"]) ? error["details"] : [];
  const codes = details.map((detail) => (isRecord(detail) ? detail["errorCode"] : undefined));
  if (status === 404 || codes.includes("UNREGISTERED")) return true;
  const message = error !== null ? String(error["message"] ?? "") : "";
  return status === 400 && codes.includes("INVALID_ARGUMENT") && /registration token/i.test(message);
};

const columnOf = (target: PushTarget): [string, string] =>
  "deviceId" in target ? ["id", String(target.deviceId || "")] : ["userId", String(target.userId || "")];

const devicesOf = async (db: D1Like, target: PushTarget): Promise<PushDevice[]> => {
  const [column, value] = columnOf(target);
  if (value === "") return [];
  const { results = [] } = await db.prepare(`SELECT id, platform, token, locale FROM push_device WHERE ${column} = ?`).bind(value).all();
  return results
    .map((row) => ({
      id: String(row["id"]),
      platform: row["platform"] === "ios" ? ("ios" as const) : ("android" as const),
      token: String(row["token"] || ""),
      locale: String(row["locale"] || ""),
    }))
    .filter((device) => device.token !== "");
};

const devLine = (target: PushTarget, devices: number, { id, title, body, url }: PushMessage, locale: string | null): string => {
  const [column, value] = columnOf(target);
  const lang = locale === null ? "" : ` locale=${locale}`;
  return `[push:dev] ${column === "id" ? "device" : "user"}=${value} devices=${devices}${lang} id=${id} title=${JSON.stringify(title)} body=${JSON.stringify(body)} url=${url}`;
};

const textFor = (message: PushMessageFor, locale: string): PushMessage =>
  textOf(typeof message === "function" ? message(locale) : message);

/**
 * Push `message` to every device of `target`. `message` is what every device
 * gets, or a function of a device's `locale` (the language tag it registered
 * with, empty when it sent none) answering what that device gets, so each
 * reads the push in its own language. Never throws: whatever goes wrong is
 * logged, and the outcome counts what happened.
 */
export const sendPush = async (
  env: PushEnv,
  db: D1Like,
  target: PushTarget,
  message: PushMessageFor,
  options: SendOptions = {},
): Promise<PushOutcome> => {
  const outcome: PushOutcome = { devices: 0, sent: 0, pruned: 0, failed: 0, dev: "" };
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const devices = await devicesOf(db, target);
    outcome.devices = devices.length;
    if (!env.FCM_SERVICE_ACCOUNT_JSON) {
      const locales = typeof message === "function" ? [...new Set(devices.map((device) => device.locale))] : [null];
      outcome.dev = (locales.length > 0 ? locales : [""]).map((locale) => devLine(target, devices.length, textFor(message, locale ?? ""), locale)).join("\n");
      console.log(outcome.dev);
      return outcome;
    }
    const account = serviceAccountOf(env.FCM_SERVICE_ACCOUNT_JSON);
    const projectId = String(env.FCM_PROJECT_ID || account?.project_id || "");
    if (account === null || projectId === "") {
      console.error("[push] FCM_SERVICE_ACCOUNT_JSON holds no service account, or names no project and FCM_PROJECT_ID is unset; nothing was sent");
      outcome.failed = devices.length;
      return outcome;
    }
    if (devices.length === 0) return outcome;
    const token = await accessTokenOf(account, options);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
    for (const device of devices) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ message: fcmMessageOf(device, textFor(message, device.locale)) }),
      }).catch(() => null);
      if (response?.ok) {
        outcome.sent++;
        continue;
      }
      if (response !== null && isDeadToken(response.status, await response.json().catch(() => null))) {
        await db.prepare("DELETE FROM push_device WHERE id = ?").bind(device.id).run();
        outcome.pruned++;
        continue;
      }
      outcome.failed++;
      console.warn(`[push] FCM answered ${response !== null ? String(response.status) : "nothing"} for device ${device.id}`);
    }
  } catch (error) {
    console.error("[push] sending failed:", error instanceof Error ? error.message : error);
  }
  return outcome;
};
