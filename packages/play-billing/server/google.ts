/**
 * @file A Google service account's OAuth bearer, minted with an RS256
 * signature over Web Crypto so it runs in a Worker: the account's JSON key is
 * parsed, a JWT assertion is signed with its PKCS#8 private key, and the token
 * endpoint trades that assertion for an access token. Tokens are cached per
 * account and scope until a minute before they expire.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_LIFETIME_SECONDS = 60 * 60;

/** The part of a Google service account's JSON key this package reads. */
export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface AccessToken {
  token: string;
  expiresAt: number;
}

/** What a caller may inject: a fake Google for a test, and the clock a token's life is measured by. */
export interface GoogleTokenOptions {
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

/** The service account a JSON key holds, or null when it is missing or not a key. */
export const serviceAccountOf = (raw: unknown): ServiceAccount | null => {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const client_email = value["client_email"];
    const private_key = value["private_key"];
    if (typeof client_email !== "string" || typeof private_key !== "string") return null;
    if (client_email === "" || private_key === "") return null;
    const token_uri = value["token_uri"];
    return { client_email, private_key, ...(typeof token_uri === "string" ? { token_uri } : {}) };
  } catch {
    return null;
  }
};

const assertionOf = async (account: ServiceAccount, scope: string, now: number): Promise<string> => {
  const header = base64UrlOfText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlOfText(
    JSON.stringify({
      iss: account.client_email,
      scope,
      aud: account.token_uri ?? TOKEN_URL,
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

/** An access token for `scope` from the service account, cached until a minute before it expires. */
export const googleAccessToken = async (account: ServiceAccount, scope: string, options: GoogleTokenOptions = {}): Promise<string> => {
  const now = options.now ?? Date.now;
  const current = now();
  const cacheKey = `${account.client_email}\n${account.private_key}\n${scope}`;
  const cached = tokens.get(cacheKey);
  if (cached !== undefined && cached.expiresAt - 60_000 > current) return cached.token;

  const assertion = await assertionOf(account, scope, Math.floor(current / 1000));
  const body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  const response = await (options.fetchImpl ?? fetch)(account.token_uri ?? TOKEN_URL, {
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
