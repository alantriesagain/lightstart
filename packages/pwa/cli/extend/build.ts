/**
 * @file `light build` extended by the PWA: after the app's static files and
 * before its prerender step, write the manifest and the service worker, amend
 * `_headers`, and put the manifest link and theme colour into the page and
 * `404.html`; the generated entry registers the worker.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/build";
import type { BuildContext } from "@lightstart/build/types.ts";
import { manifestOf } from "../../manifest.ts";
import { injectPwaTags, noCacheHeaders } from "../../html.ts";
import { appIdentityOf, readPwa } from "../../node/config.ts";
import { workerSource } from "../../node/bundle.ts";
import { cacheVersion, precacheList } from "../../worker/logic.ts";

const textOf = (value: Uint8Array | string | undefined): string => {
  if (value === undefined) return "";
  return typeof value === "string" ? value : new TextDecoder().decode(value);
};

const runPwa = async (ctx: BuildContext): Promise<void> => {
  const pwa = await readPwa(ctx.root);
  if (pwa === null) return;

  const identity = await appIdentityOf(ctx.root);
  const base = ctx.base;
  const manifest = manifestOf({ ...identity, base }, pwa);
  ctx.outputs.set("manifest.webmanifest", `${JSON.stringify(manifest, null, 2)}\n`);

  const icons = (pwa.icons ?? []).map((icon) => icon.src);
  const precache = precacheList(ctx.outputs, base, icons);
  const version = cacheVersion(ctx.outputs, icons);
  ctx.outputs.set("sw.js", await workerSource({ precache, version, base, minify: ctx.minify }));

  ctx.outputs.set("_headers", noCacheHeaders(textOf(ctx.outputs.get("_headers")), base));

  for (const page of ["index.html", "404.html"]) {
    const html = ctx.outputs.get(page);
    if (html === undefined) continue;
    ctx.outputs.set(page, injectPwaTags(textOf(html), { base, themeColor: pwa.theme_color }));
  }
};

export default defineExtension("build", {
  setup(_ctx, _args, api) {
    const names = api.steps.names();
    const step = { name: "pwa", run: runPwa };
    if (names.includes("prerender")) api.steps.before("prerender", step);
    else if (names.includes("static")) api.steps.after("static", step);
    else api.steps.add(step);
  },
});
