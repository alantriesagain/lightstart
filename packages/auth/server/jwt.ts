/**
 * @file An HS256 JWT over Web Crypto: `signToken` puts claims in a token with
 * an `exp`, and `verifyToken` answers them only when the header names HS256,
 * the signature matches and the token has not expired. It runs on a Worker's
 * `crypto.subtle`, with no node imports.
 */

/** The token's lifetime when `signToken` is not told one: thirty days. */
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const LOOKUP: Record<string, number> = {};
for (let index = 0; index < ALPHABET.length; index++) LOOKUP[ALPHABET[index] as string] = index;

/** The JSON a token's claims are read from and written to. */
export type TokenPayload = Record<string, unknown>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const encodeBase64Url = (bytes: Uint8Array): string => {
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

const decodeBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of text.replace(/=+$/, "")) {
    const value = LOOKUP[char];
    if (value === undefined) throw new Error("invalid base64url");
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
};

const keyOf = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const secretOf = (secret: string): string => {
  if (typeof secret !== "string" || encoder.encode(secret).length < 32) {
    throw new Error("JWT_SECRET must be a string of at least 32 bytes");
  }
  return secret;
};

/**
 * Sign `payload` as an HS256 JWT lasting `ttlSeconds` (thirty days by
 * default), adding `iat` and `exp`. A missing or short secret throws.
 */
export const signToken = async (payload: TokenPayload, secret: string, ttlSeconds: number = TOKEN_TTL_SECONDS): Promise<string> => {
  const key = await keyOf(secretOf(secret));
  const now = Math.floor(Date.now() / 1000);
  const claims: TokenPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
  const input = `${header}.${body}`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return `${input}.${encodeBase64Url(new Uint8Array(signature))}`;
};

/**
 * Verify `token` and answer its claims, or null when it is malformed, names
 * another algorithm, carries a bad signature or has expired.
 */
export const verifyToken = async (token: string, secret: string): Promise<TokenPayload | null> => {
  try {
    if (typeof secret !== "string" || encoder.encode(secret).length < 32) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerPart, bodyPart, signaturePart] = parts as [string, string, string];
    const header: unknown = JSON.parse(decoder.decode(decodeBase64Url(headerPart)));
    if (header === null || typeof header !== "object" || Array.isArray(header)) return null;
    if ((header as Record<string, unknown>)["alg"] !== "HS256") return null;
    const key = await keyOf(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signaturePart),
      encoder.encode(`${headerPart}.${bodyPart}`),
    );
    if (!valid) return null;
    const payload: unknown = JSON.parse(decoder.decode(decodeBase64Url(bodyPart)));
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
    const claims = payload as TokenPayload;
    const exp = claims["exp"];
    if (typeof exp !== "number" || exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
};
