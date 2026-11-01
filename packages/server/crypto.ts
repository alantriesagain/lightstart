/**
 * @file The hashing seam: HMAC-SHA256, SHA-256, a constant-time comparison and a random token,
 * synchronous because both node's `node:crypto` and WebCrypto's synchronous half compile natively
 * (`probes/crypto-node.ts`, `probes/crypto-web.ts`). The core imports no crypto: the node adapter
 * fills it from `node:crypto` (`node/crypto.ts`), and a fetch host from WebCrypto (asynchronous,
 * so a later adapter, not this synchronous seam). Signed cookie values sit on top: a value and its
 * HMAC, joined by a dot, verified against one secret or a rotation list, the comparison constant
 * time.
 */
export abstract class Crypto {
  /** Base64url HMAC-SHA256 of `data` under `key`. */
  abstract hmacSha256(key: string, data: string): string;

  /** Hex SHA-256 of text (UTF-8) or bytes. */
  abstract sha256(data: string | Uint8Array): string;

  /** Whether `a` and `b` are equal, comparing without an early exit on their first difference. */
  abstract safeEqual(a: string, b: string): boolean;

  /** `bytes` cryptographically random bytes as base64url. */
  abstract randomToken(bytes: number): string;
}

/** `value` with its signature appended: `value.signature`. */
export const signCookieValue = (crypto: Crypto, secret: string, value: string): string => value + "." + crypto.hmacSha256(secret, value);

/**
 * The value of a signed cookie, or null when it is malformed or matches no secret. Every secret
 * is tried in order, so a signing key can rotate: pass `[newSecret, oldSecret]` to accept both.
 */
export const unsignCookieValue = (crypto: Crypto, secret: string | string[], signed: string): string | null => {
  const at = signed.lastIndexOf(".");
  if (at < 0) return null;
  const value = signed.slice(0, at);
  const signature = signed.slice(at + 1);
  if (signature === "") return null;
  const secrets = typeof secret === "string" ? [secret] : secret;
  for (const key of secrets) {
    if (crypto.safeEqual(crypto.hmacSha256(key, value), signature)) return value;
  }
  return null;
};
