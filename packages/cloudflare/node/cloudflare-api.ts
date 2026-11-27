/**
 * @file Cloudflare's HTTP API, apart from the commands: one account's token
 * answers `get`, `post` and `patch` for paths under the account, each
 * answering the response's `result` and throwing Cloudflare's own error
 * messages otherwise. The fetch is injectable, so no test reaches the network,
 * and the token never reaches an error or a message.
 */

/** The part of a response this module reads, so a fake fetch can stand in. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** A fetch-shaped function; a fake records the method, path and body it is given. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<FetchResponse>;

/** What `cloudflareApi` is given: the account, its token and an optional fetch. */
export interface CloudflareApiOptions {
  accountId: string;
  apiToken: string;
  fetch?: FetchLike;
  /** The API base; Cloudflare's own when absent (a test may override it). */
  baseUrl?: string;
}

/** One account's API: paths are relative to `/accounts/<account>`. */
export interface CloudflareApi {
  get(path: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  patch(path: string, body?: unknown): Promise<unknown>;
}

const DEFAULT_BASE = "https://api.cloudflare.com/client/v4";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An API error carrying Cloudflare's message and its error codes, so a caller can match on a code. */
export class CloudflareApiError extends Error {
  readonly codes: number[];

  constructor(message: string, codes: number[]) {
    super(message);
    this.name = "CloudflareApiError";
    this.codes = codes;
  }
}

const errorText = (payload: unknown, status: number): string => {
  if (isRecord(payload) && Array.isArray(payload["errors"])) {
    const messages = payload["errors"]
      .map((error) => (isRecord(error) && typeof error["message"] === "string" ? error["message"] : ""))
      .filter((message) => message !== "");
    if (messages.length > 0) return messages.join("; ");
  }
  return `Cloudflare request failed (${status})`;
};

const errorCodes = (payload: unknown): number[] => {
  if (!isRecord(payload) || !Array.isArray(payload["errors"])) return [];
  return payload["errors"]
    .map((error) => (isRecord(error) && typeof error["code"] === "number" ? error["code"] : Number.NaN))
    .filter((code) => !Number.isNaN(code));
};

/** Build an account's API over an injectable fetch. */
export const cloudflareApi = (options: CloudflareApiOptions): CloudflareApi => {
  const send: FetchLike = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
  const account = `/accounts/${encodeURIComponent(options.accountId)}`;

  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const url = `${baseUrl}${account}${path.startsWith("/") ? path : `/${path}`}`;
    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers: { Authorization: `Bearer ${options.apiToken}`, "Content-Type": "application/json" },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const response = await send(url, init);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`Cloudflare request failed (${response.status})`);
    }
    if (!isRecord(payload) || payload["success"] !== true) {
      throw new CloudflareApiError(errorText(payload, response.status), errorCodes(payload));
    }
    return payload["result"];
  };

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    patch: (path, body) => request("PATCH", path, body),
  };
};
