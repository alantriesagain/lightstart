/**
 * @file @lightstart/cloudflare: deploying a light app to Cloudflare Pages. A
 * project may keep `src/cloudflare.ts` or `.js`, default-exporting
 * `defineCloudflare({ project, d1, r2, secrets })`; `light cf:deploy` uploads
 * a build to that Pages project (the package's name when none is given),
 * `light cf:d1:setup` creates and binds its D1 database, `light cf:r2:setup`
 * creates and binds its R2 bucket as `STORAGE`, and `light cf:secrets` puts
 * the named secrets from `.env`.
 */

/** What `src/cloudflare` declares. */
export interface CloudflareConfig {
  /** The Pages project the app deploys to; the package's name when absent. */
  project?: string;
  /** The D1 database's name, bound as `DB` by `light cf:d1:setup`. */
  d1?: string;
  /** The R2 bucket's name, bound as `STORAGE` by `light cf:r2:setup`. */
  r2?: string;
  /** The secrets `light cf:secrets` puts from `.env` onto the Pages project. */
  secrets?: string[];
}

/** Declare an app's Cloudflare deploy. */
export const defineCloudflare = (config: CloudflareConfig): CloudflareConfig => config;
