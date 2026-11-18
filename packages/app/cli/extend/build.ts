/**
 * @file `light build` extended by the app: a step that runs before the page is
 * read and generates the manifest, so the build sees the project's folders;
 * then a step after the page is rewritten that adds what a static host needs
 * from the routes (`404.html`, `sitemap.xml`, `robots.txt` and `_headers`), and
 * a step after that which renders every concrete route when prerendering is on.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/build";
import type { RoutesMap } from "@lightstart/router";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { generate, infoOf, routesOf } from "../../node/generate.ts";
import { pathsOf } from "../../node/paths.ts";
import { prerender } from "../../node/prerender.ts";

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

const prerenders = async (app: string): Promise<boolean> => {
  try {
    const module = (await import(`${pathToFileURL(app).href}?mtime=${String(Date.now())}`)) as { default?: { prerender?: unknown } };
    return module.default !== undefined && module.default.prerender === true;
  } catch {
    return false;
  }
};

export default defineExtension("build", {
  args: { prerender: { flag: true, description: "Render every concrete route into its own index.html" } },
  setup(_ctx, args, api) {
    const wanted = (args as { prerender?: unknown } | undefined)?.prerender === true;
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
        ctx.data.set("app-routes", routes);
        if (info.url === undefined) {
          ctx.outputs.set("robots.txt", "User-agent: *\nAllow: /\n");
        } else {
          const paths = routes === null ? [] : await pathsOf(routes as RoutesMap);
          ctx.outputs.set("sitemap.xml", sitemapOf(info.url, paths));
          ctx.outputs.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${info.url}/sitemap.xml\n`);
        }

        ctx.outputs.set("_headers", headersOf([...ctx.outputs.keys()]));
      },
    });
    api.steps.after("static", {
      name: "prerender",
      async run(ctx) {
        const app = join(ctx.root, "src", "app.ts");
        if (!existsSync(app)) return;
        if (!wanted && !(await prerenders(app))) return;

        const routes = ctx.data.get("app-routes");
        const paths = routes === null || routes === undefined ? [] : await pathsOf(routes as RoutesMap);
        if (paths.length === 0) return;

        const started = Date.now();
        const written = await prerender({ root: ctx.root, outputs: ctx.outputs, paths });
        ctx.log(`prerendered ${String(written)} pages in ${String(Date.now() - started)} ms`);
      },
    });
  },
});
