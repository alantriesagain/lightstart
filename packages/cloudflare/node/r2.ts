/**
 * @file R2 over Cloudflare's HTTP API: find or create a bucket and bind it to
 * the Pages project as `STORAGE`. `r2Settings` gathers the account's
 * credentials (the environment over the project's `.env`), the Pages project
 * and the bucket name from `src/cloudflare`, naming whatever is missing.
 */

import type { CloudflareApi } from "./cloudflare-api.ts";
import { CloudflareApiError } from "./cloudflare-api.ts";
import { cloudflareConfigOf, credentialsOf } from "./d1.ts";
import { projectNameOf } from "./deploy.ts";

/** What an R2 command reads: the credentials, the Pages project and the bucket name. */
export interface R2Settings {
  accountId: string;
  apiToken: string;
  project: string;
  bucket: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const assertBucketName = (name: string): void => {
  if (!BUCKET_NAME.test(name)) {
    throw new Error(
      `The R2 bucket name ${name} is invalid: use 3-63 lower-case letters, digits and dashes, starting and ending with a letter or digit`,
    );
  }
};

/** Read the credentials, the Pages project and `src/cloudflare`'s `r2`, failing with what is missing. */
export const r2Settings = async (project: string): Promise<R2Settings> => {
  const config = await cloudflareConfigOf(project);
  const r2 = config["r2"];
  if (r2 !== undefined && (typeof r2 !== "string" || r2.trim() === "")) {
    throw new Error("src/cloudflare has an r2 that is not a bucket name");
  }
  if (typeof r2 !== "string") {
    throw new Error('No R2 bucket: name one in src/cloudflare (defineCloudflare({ r2: "<name>" }))');
  }
  assertBucketName(r2);
  const { accountId, apiToken } = credentialsOf(project);
  return { accountId, apiToken, project: await projectNameOf(project), bucket: r2 };
};

/** The bucket's name when the account has one by that name, else null. */
export const bucketOf = async (api: CloudflareApi, name: string): Promise<string | null> => {
  let cursor: string | undefined;
  for (;;) {
    const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
    const result = await api.get(`/r2/buckets${query}`);
    const rows = isRecord(result) && Array.isArray(result["buckets"])
      ? result["buckets"]
      : Array.isArray(result)
        ? result
        : [];
    for (const row of rows) {
      if (isRecord(row) && row["name"] === name) return name;
    }
    const info = isRecord(result) && isRecord(result["result_info"]) ? result["result_info"] : undefined;
    const next = info !== undefined && typeof info["cursor"] === "string" ? info["cursor"] : undefined;
    if (info === undefined || info["is_truncated"] !== true || next === undefined) return null;
    cursor = next;
  }
};

const r2Disabled = (error: unknown): boolean =>
  error instanceof CloudflareApiError && error.codes.includes(10042);

const R2_DISABLED =
  "R2 is not enabled on this Cloudflare account: enable it in the dashboard (R2 Object Storage), then run light cf:r2:setup again";

/** The bucket's name, creating it when the account has none by that name. */
export const ensureBucket = async (api: CloudflareApi, name: string): Promise<string> => {
  assertBucketName(name);
  try {
    const existing = await bucketOf(api, name);
    if (existing !== null) return existing;
    await api.post("/r2/buckets", { name });
  } catch (error) {
    if (r2Disabled(error)) throw new Error(R2_DISABLED);
    throw error;
  }
  return name;
};

/** Bind the bucket as `STORAGE` to the Pages project, production and preview alike. */
export const bindBucket = async (api: CloudflareApi, project: string, name: string): Promise<void> => {
  await api.patch(`/pages/projects/${encodeURIComponent(project)}`, {
    deployment_configs: {
      production: { r2_buckets: { STORAGE: { name } } },
      preview: { r2_buckets: { STORAGE: { name } } },
    },
  });
};
