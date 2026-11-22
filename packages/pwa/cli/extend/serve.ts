/**
 * @file `light serve` extended by the PWA: answer the manifest from `src/pwa`,
 * and answer the worker with one that unregisters itself. With `--pwa` the
 * worker is the real one built from the current sources and an empty precache
 * list, so offline and updates can be tried in development.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { renderShell } from "@lightstart/dev/shell";
import { text } from "@lightstart/server";
import { baseScope, normalizeBase } from "../../base.ts";
import { injectPwaTags } from "../../html.ts";
import { manifestOf } from "../../manifest.ts";
import { workerSource } from "../../node/bundle.ts";
import { appIdentityOf, pwaPathOf, readPwa } from "../../node/config.ts";
import { cacheVersion } from "../../worker/logic.ts";

const UNREGISTER = 'self.addEventListener("install", () => self.skipWaiting());\nself.addEventListener("activate", (event) => event.waitUntil(self.registration.unregister()));\n';

const workerReply = (source: string, base: string) => text(source).header("content-type", "text/javascript; charset=utf-8").header("cache-control", "no-store").header("service-worker-allowed", baseScope(base));

export default defineExtension("serve", {
  args: {
    pwa: { flag: true, description: "Serve the real service worker built from the current sources" },
  },
  async setup(ctx, args, api) {
    if (pwaPathOf(ctx.projectDir) === null) return;
    const pwa = await readPwa(ctx.projectDir);
    const identity = await appIdentityOf(ctx.projectDir);
    const base = normalizeBase(identity.base);

    api.app.get("/manifest.webmanifest", () => text(`${JSON.stringify(manifestOf({ ...identity, base }, pwa ?? {}), null, 2)}\n`).header("content-type", "application/manifest+json; charset=utf-8").header("cache-control", "no-store"));

    let source = UNREGISTER;
    if (args.pwa) source = await workerSource({ precache: [], version: cacheVersion(new Map()), base, minify: false });
    api.app.get("/sw.js", () => workerReply(source, base));

    api.page((_c, html) => injectPwaTags(renderShell(html, api.importmap, { reload: args.watch }), { base, themeColor: pwa?.theme_color }));
  },
});
