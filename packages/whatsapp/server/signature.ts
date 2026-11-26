/**
 * @file The two checks Meta's webhook asks of an endpoint: answering the
 * subscription handshake with the token set on the app, and proving a delivery
 * came from Meta by its `X-Hub-Signature-256`, an HMAC-SHA256 of the body
 * exactly as sent, keyed with the app secret. Plain WebCrypto with no imports,
 * so the same file runs in a Worker, in node and in the tests.
 */

const encoder = new TextEncoder();

/** The HMAC-SHA256 of `data` under `secret`, as bytes. */
const hmac = async (secret: string, data: string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
};

/** `bytes` as lowercase hex. */
const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** The bytes `hex` names; an empty array for malformed text. */
const fromHex = (hex: string): Uint8Array => Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));

/**
 * Whether two byte strings are equal, in time that depends on their length
 * only, so a caller comparing a secret leaks nothing about where it differs.
 *
 * @param a the first bytes
 * @param b the second bytes
 * @returns whether they hold the same bytes
 */
export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
};

/**
 * The challenge to answer Meta's subscription handshake with, or null when the
 * mode is not `subscribe`, no token is set, or the token sent is not it.
 *
 * @param query the request's query
 * @param token the value of `WHATSAPP_VERIFY_TOKEN`
 * @returns the challenge to repeat, or null
 */
export const verifyChallenge = (query: URLSearchParams, token: string): string | null => {
  if (!token || query.get("hub.mode") !== "subscribe") return null;
  if (!constantTimeEqual(encoder.encode(String(query.get("hub.verify_token") ?? "")), encoder.encode(token))) return null;
  return String(query.get("hub.challenge") ?? "");
};

/**
 * Whether `header` is `sha256=<hex>` of `rawBody` under `secret`.
 *
 * @param rawBody the body exactly as it arrived
 * @param header the `X-Hub-Signature-256` value
 * @param secret the app secret, `WHATSAPP_APP_SECRET`
 * @returns whether Meta signed those bytes with that secret
 */
export const verifySignature = async (rawBody: string, header: string | null | undefined, secret: string): Promise<boolean> => {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(String(header ?? "").trim());
  if (!secret || !match) return false;
  return constantTimeEqual(fromHex((match[1] ?? "").toLowerCase()), await hmac(secret, rawBody));
};

/**
 * The `X-Hub-Signature-256` Meta would send with `rawBody`: the inverse of
 * `verifySignature`, for tests and local tooling.
 *
 * @param rawBody the body as it would be sent
 * @param secret the app secret
 * @returns the header value Meta would send
 */
export const signatureOf = async (rawBody: string, secret: string): Promise<string> => `sha256=${toHex(await hmac(secret, rawBody))}`;
