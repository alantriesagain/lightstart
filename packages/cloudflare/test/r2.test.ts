// node-only
/**
 * @file R2 over a fake Cloudflare API: a bucket is created only when it is
 * missing, the bind PATCH carries production and preview, Cloudflare's 10042
 * becomes a clear "enable R2" error, a bad bucket name is refused before any
 * call, and an API error carries Cloudflare's message and not the token.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { cloudflareApi } from "../node/cloudflare-api.ts";
import type { FetchLike } from "../node/cloudflare-api.ts";
import { bindBucket, bucketOf, ensureBucket } from "../node/r2.ts";

type Request = { method: string; path: string; body: unknown };
type Answer = { status?: number; payload: unknown };

const fakeFetch = (answer: (request: Request) => Answer): { fetch: FetchLike; calls: Request[] } => {
  const calls: Request[] = [];
  const fetch: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    const body: unknown = init?.body === undefined ? undefined : (JSON.parse(init.body) as unknown);
    const parsed = new URL(url);
    const request: Request = { method, path: `${parsed.pathname}${parsed.search}`, body };
    calls.push(request);
    const { status, payload } = answer(request);
    const code = status ?? 200;
    return { ok: code >= 200 && code < 300, status: code, json: async () => payload };
  };
  return { fetch, calls };
};

const success = (result: unknown): Answer => ({ payload: { success: true, result } });

const main = async (): Promise<void> => {
  const token = "super-secret-token";
  const accountId = "acc";

  const missing = fakeFetch((request) =>
    request.method === "GET" ? success({ buckets: [] }) : success({ name: "photos" }),
  );
  const created = cloudflareApi({ accountId, apiToken: token, fetch: missing.fetch });
  eq("a missing bucket is created and its name answered", await ensureBucket(created, "photos"), "photos");
  eq("the create is a GET then a POST", missing.calls.map((call) => call.method).join(" "), "GET POST");
  ok("the list asks the account's buckets", (missing.calls[0]?.path ?? "").includes("/accounts/acc/r2/buckets"));
  eq("the create sends only the name", JSON.stringify(missing.calls[1]?.body), '{"name":"photos"}');

  const found = fakeFetch(() => success({ buckets: [{ name: "photos" }, { name: "other" }] }));
  const existing = cloudflareApi({ accountId, apiToken: token, fetch: found.fetch });
  eq("an existing bucket is not created again", await ensureBucket(existing, "photos"), "photos");
  eq("only the lookup ran", found.calls.map((call) => call.method).join(" "), "GET");
  eq("bucketOf answers null when no row matches", String(await bucketOf(existing, "absent")), "null");

  const second = fakeFetch((request) =>
    (request.path ?? "").includes("cursor=")
      ? success({ buckets: [{ name: "photos" }] })
      : success({ buckets: [], result_info: { cursor: "next", is_truncated: true } }),
  );
  const paged = cloudflareApi({ accountId, apiToken: token, fetch: second.fetch });
  eq("a later page is read too", String(await bucketOf(paged, "photos")), "photos");
  eqn("both pages were fetched", second.calls.length, 2);

  const bound = fakeFetch(() => success({}));
  const binder = cloudflareApi({ accountId, apiToken: token, fetch: bound.fetch });
  await bindBucket(binder, "site", "photos");
  eq("binding is a PATCH on the Pages project", bound.calls[0]?.method, "PATCH");
  ok("the PATCH names the project", (bound.calls[0]?.path ?? "").includes("/accounts/acc/pages/projects/site"));
  eq(
    "the PATCH binds STORAGE in production and preview",
    JSON.stringify(bound.calls[0]?.body),
    JSON.stringify({
      deployment_configs: {
        production: { r2_buckets: { STORAGE: { name: "photos" } } },
        preview: { r2_buckets: { STORAGE: { name: "photos" } } },
      },
    }),
  );

  const disabled = fakeFetch((request) =>
    request.method === "GET"
      ? success({ buckets: [] })
      : { status: 403, payload: { success: false, errors: [{ code: 10042, message: "Please enable R2 through the Cloudflare Dashboard" }] } },
  );
  const disabledApi = cloudflareApi({ accountId, apiToken: token, fetch: disabled.fetch });
  let disabledSaid = "";
  try {
    await ensureBucket(disabledApi, "photos");
  } catch (error) {
    disabledSaid = error instanceof Error ? error.message : String(error);
  }
  ok("a 10042 becomes the enable-R2 message", disabledSaid.includes("R2 is not enabled on this Cloudflare account"));
  ok("the enable-R2 message names the command", disabledSaid.includes("light cf:r2:setup"));
  ok("the 10042 message is not Cloudflare's text", !disabledSaid.includes("through the Cloudflare Dashboard"));

  const refused = fakeFetch(() => success({ buckets: [] }));
  const refusing = cloudflareApi({ accountId, apiToken: token, fetch: refused.fetch });
  let refusedSaid = "";
  try {
    await ensureBucket(refusing, "Bad_Name");
  } catch (error) {
    refusedSaid = error instanceof Error ? error.message : String(error);
  }
  ok("a bad bucket name is refused", refusedSaid.includes("is invalid"));
  eqn("a bad bucket name sends no request", refused.calls.length, 0);

  const failed = fakeFetch(() => ({ status: 403, payload: { success: false, errors: [{ code: 1000, message: "not allowed here" }] } }));
  const failing = cloudflareApi({ accountId, apiToken: token, fetch: failed.fetch });
  let said = "";
  try {
    await ensureBucket(failing, "photos");
  } catch (error) {
    said = error instanceof Error ? error.message : String(error);
  }
  ok("an API error carries Cloudflare's message", said.includes("not allowed here"));
  ok("an API error never carries the token", !said.includes(token));

  done();
};

await main();
