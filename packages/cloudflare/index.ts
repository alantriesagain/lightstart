/**
 * @file @lightstart/cloudflare: deploying a light app to Cloudflare Pages. A
 * project may keep `src/cloudflare.ts` or `.js`, default-exporting
 * `defineCloudflare({ project })`; `light cf:deploy` uploads a build to that
 * Pages project (the package's name when none is given).
 */

/** What `src/cloudflare` declares. */
export interface CloudflareConfig {
  /** The Pages project the app deploys to; the package's name when absent. */
  project?: string;
}

/** Declare an app's Cloudflare deploy. */
export const defineCloudflare = (config: CloudflareConfig): CloudflareConfig => config;
