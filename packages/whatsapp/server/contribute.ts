/**
 * @file What `@lightstart/whatsapp` adds to an app's server, declared in its
 * `package.json` (`light.server`): the three WhatsApp tables, the endpoints a
 * person uses to connect or sign in, Meta's webhook, and the `whatsapp`
 * identity the auth core serves. Importing this module registers the identity
 * once, exactly as `@lightstart/auth` expects a package's contribution to.
 */

import { defineEndpoint, defineServerContribution, type D1Like, type Endpoint } from "@lightstart/api/server";
import { registerIdentity } from "@lightstart/auth/server";
import { clientIp, hashIp, rateSalt } from "@lightstart/visitor/server";

import { codeStatus, issueCode, issueLogin, receive, whatsappLogin } from "./core.ts";
import { confirmedHooks } from "./hooks.ts";
import { whatsappModels } from "./models.ts";
import { eventsOf } from "./parse.ts";
import { verifyChallenge, verifySignature, signatureOf } from "./signature.ts";
import type { WhatsappConfirmed, WhatsappOutcome } from "./types.ts";

export { signatureOf };

/** The `purpose` a receipt with an outcome confirms, when it confirms one. */
const CONFIRMED: Partial<Record<WhatsappOutcome, "connect" | "login">> = { connected: "connect", login: "login" };

/** A refusal as a JSON response, so this file needs no server helper. */
const fail = (error: string, status: number): Response =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });

/** Whether `header` signs the delivery: an HMAC over the body exactly as Meta sent it, never a re-serialization of the parsed JSON. */
const signedDelivery = async (request: Request, rawBody: string | null, secret: string): Promise<boolean> =>
  rawBody !== null && (await verifySignature(rawBody, request.headers.get("x-hub-signature-256"), secret));

/** A signed-in caller's id, or empty. */
const callerId = (caller: { id?: string } | null): string => (caller === null ? "" : String(caller.id ?? ""));

/** Ask for a connect code for the signed-in person. */
const connectCode = defineEndpoint({
  path: "/api/whatsapp-code",
  method: "POST",
  access: "auth",
  handler: async ({ caller, db, env }) => {
    const userId = callerId(caller);
    if (!userId) return fail("sign in", 401);
    const issued = await issueCode(db, userId);
    if (!issued.ok) return fail(issued.error, issued.status);
    return { code: issued.code, expiresAt: issued.expiresAt, to: String(env["WHATSAPP_NUMBER"] ?? "") };
  },
});

/** Ask for a sign-in code and nonce for a device. */
const loginCode = defineEndpoint({
  path: "/api/whatsapp-login",
  method: "POST",
  access: "public",
  handler: async ({ request, body, db, env }) => {
    const ip = clientIp(request, { trusted: true });
    const ipHash = await hashIp(rateSalt(env), ip);
    const deviceId = body !== null && typeof body === "object" ? (body as Record<string, unknown>)["deviceId"] : undefined;
    const issued = await issueLogin(db, ipHash, { deviceId });
    if (!issued.ok) return fail(issued.error, issued.status);
    return new Response(
      JSON.stringify({ code: issued.code, nonce: issued.nonce, expiresAt: issued.expiresAt, to: String(env["WHATSAPP_NUMBER"] ?? "") }),
      { headers: { "content-type": "application/json", "cache-control": "private, no-store" } },
    );
  },
});

/** Where connecting stands for the signed-in person. */
const status = defineEndpoint({
  path: "/api/whatsapp-status",
  method: "GET",
  access: "auth",
  handler: async ({ caller, db }) => {
    const userId = callerId(caller);
    if (!userId) return fail("sign in", 401);
    return codeStatus(db, userId);
  },
});

/** Meta's subscription handshake. */
const handshake = defineEndpoint({
  path: "/api/whatsapp-webhook",
  method: "GET",
  access: "public",
  handler: ({ request, env }) => {
    const challenge = verifyChallenge(new URL(request.url).searchParams, String(env["WHATSAPP_VERIFY_TOKEN"] ?? ""));
    return challenge === null ? fail("forbidden", 403) : new Response(challenge, { headers: { "content-type": "text/plain" } });
  },
});

/** Meta's delivery: signature first, then the events, then the hooks. */
const delivery = defineEndpoint({
  path: "/api/whatsapp-webhook",
  method: "POST",
  access: "public",
  handler: async ({ request, body, rawBody, db, env }) => {
    if (!(await signedDelivery(request, rawBody, String(env["WHATSAPP_APP_SECRET"] ?? "")))) return fail("bad signature", 401);
    const events = eventsOf(body, { phoneNumberId: String(env["WHATSAPP_PHONE_NUMBER_ID"] ?? "") });
    const binding = db as D1Like;
    const receipts = await receive(binding, events, env).catch(() => []);
    for (const { outcome, userId, deviceId } of receipts) {
      const purpose = CONFIRMED[outcome];
      if (purpose === undefined) continue;
      const confirmed: WhatsappConfirmed = { purpose, userId, deviceId, env, db: binding };
      await confirmedHooks(confirmed);
    }
    return { ok: true };
  },
});

/**
 * The WhatsApp endpoints, made from the server's environment.
 *
 * @param _env the server's environment (the endpoints read it at call time)
 * @returns the connect, login, status and webhook endpoints
 */
export const whatsappEndpoints = (_env: Record<string, unknown>): Endpoint[] => [connectCode, loginCode, status, handshake, delivery];

registerIdentity({
  name: "whatsapp",
  redeem: (body, db, env) => whatsappLogin.redeem(body, db, env),
});

export default defineServerContribution({
  models: whatsappModels,
  endpoints: (env) => whatsappEndpoints(env),
});
