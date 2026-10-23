// @ts-nocheck
/**
 * Vendor aggregator for marked (markdown parser).
 *
 * Dev: served at `/vendor/marked.js`; the browser fetches from
 * cdn.jsdelivr.net live. Prod: bundled by esbuild into a single
 * `vendor/marked.js` shipped with the deploy.
 *
 * Consumers lazy-import this file via `await import("/vendor/marked.js")`
 * so marked is fetched only when the first `<lc-markdown>` connects.
 */

export { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
