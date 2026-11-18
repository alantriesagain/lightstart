/**
 * @file `light build` extended by the app: a step that runs before the page is
 * read and generates the manifest, so the build sees the project's folders;
 * then a step after the page is rewritten that adds what a static host needs
 * from the routes (`404.html`, `sitemap.xml`, `robots.txt` and `_headers`).
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/build";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { generate, infoOf, routesOf } from "../../node/generate.ts";

const HASHED = /-[A-Za-z0-9_-]+\.(?:js|css)$/;

const sitemapOf = (url: string, paths: readonly string[]): string => {
  const urls = paths.filter((path) => !path.includes(":") && !path.includes("*")).map((path) => `${url}${path.startsWith("/") ? path : `/${path}`}`).sort();
  const entries = urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
};

const headersOf = (paths: readonly string[]): string => {
  const hashed = paths
    .filter((path) => HASHED.test(path))
    .map((path) => `/${path}`)
    .sort();
  const rules = [
    ...[...new Set(["/index.html", "/404.html", "/"])].sort().map((path) => `${path}\n  Cache-Control: no-cache`),
    ...hashed.map((path) => `${path}\n  Cache-Control: public, max-age=31536000, immutable`),
  ];
  return `${rules.join("\n\n")}\n`;
};

export default defineExtension("build", {
  setup(_ctx, _args, api) {
    api.steps.before("page", {
      name: "app",
      async run(ctx) {
        await generate(ctx.root);
      },
    });
    api.steps.after("html", {
      name: "static",
      async run(ctx) {
        const app = join(ctx.root, "src", "app.ts");
        if (!existsSync(app)) return;

        const page = relative(ctx.root, ctx.pagePath).split("\\").join("/");
        const html = ctx.outputs.get(page);
        if (html !== undefined) ctx.outputs.set("404.html", html);

        const info = await infoOf(app);
        const routesPath = join(ctx.root, "src", "routes.ts");
        const routes = existsSync(routesPath) ? await routesOf(routesPath) : null;
        if (info.url === undefined) {
          ctx.outputs.set("robots.txt", "User-agent: *\nAllow: /\n");
        } else {
          ctx.outputs.set("sitemap.xml", sitemapOf(info.url, routes === null ? [] : Object.keys(routes)));
          ctx.outputs.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${info.url}/sitemap.xml\n`);
        }

        ctx.outputs.set("_headers", headersOf([...ctx.outputs.keys()]));
      },
    });
  },
});
