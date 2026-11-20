/**
 * @file `light build` extended by the app: a step that runs before the page is
 * read and generates the manifest, so the build sees the project's folders;
 * then a step after the page is rewritten that adds what a static host needs
 * from the routes (`404.html`, `sitemap.xml`, `robots.txt` and `_headers`), and
 * a step after that which renders every concrete route when prerendering is on.
 */

import "@lightstart/light/markup";
import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/build";
import type { RoutesMap } from "@lightstart/router";
import { relative } from "node:path";
import { pathToFileURL } from "node:url";
import type { PrerenderRenderer } from "../../index.ts";
import { appOf, generate, infoOf, routesOf, routesPathOf } from "../../node/generate.ts";
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
    .filter((path) => path !== "worker.js" && HASHED.test(path))
    .map((path) => `/${path}`)
    .sort();
  const rules = [
    ...[...new Set(["/index.html", "/404.html", "/"])].sort().map((path) => `${path}\n  Cache-Control: no-cache`),
    ...hashed.map((path) => `${path}\n  Cache-Control: public, max-age=31536000, immutable`),
  ];
  return `${rules.join("\n\n")}\n`;
};

interface PrerenderChoice {
  prerender: boolean;
  renderer: PrerenderRenderer | undefined;
}

const prerenders = async (app: string): Promise<PrerenderChoice> => {
  try {
    const module = (await import(`${pathToFileURL(app).href}?mtime=${String(Date.now())}`)) as {
      default?: { prerender?: unknown; prerenderRenderer?: unknown };
    };
    const config = module.default;
    const renderer = config?.prerenderRenderer;
    return {
      prerender: config?.prerender === true,
      renderer: renderer === "browser" || renderer === "markup" ? renderer : undefined,
    };
  } catch {
    return { prerender: false, renderer: undefined };
  }
};

export default defineExtension("build", {
  args: {
    prerender: { flag: true, description: "Render every concrete route into its own index.html" },
    renderer: { choices: ["markup", "browser"] as const, description: "How to prerender: light's markup host in node (default) or headless Chromium" },
  },
  setup(_ctx, args, api) {
    const given = args as { prerender?: unknown; renderer?: unknown } | undefined;
    const wanted = given?.prerender === true;
    const chosen = given?.renderer === "browser" || given?.renderer === "markup" ? given.renderer : undefined;
    api.steps.before("page", {
      name: "app",
      async run(ctx) {
        await generate(ctx.root, { dev: false });
      },
    });
    api.steps.after("html", {
      name: "static",
      async run(ctx) {
        const app = appOf(ctx.root);
        if (app === null) return;

        const page = relative(ctx.root, ctx.pagePath).split("\\").join("/");
        const html = ctx.outputs.get(page);
        if (html !== undefined) ctx.outputs.set("404.html", html);

        const info = await infoOf(app.path);
        const routesPath = routesPathOf(ctx.root);
        const routes = routesPath === null ? null : await routesOf(routesPath);
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
        const app = appOf(ctx.root);
        if (app === null) return;
        const fromApp = await prerenders(app.path);
        if (!wanted && !fromApp.prerender) return;

        const routes = ctx.data.get("app-routes");
        const paths = routes === null || routes === undefined ? [] : await pathsOf(routes as RoutesMap);
        if (paths.length === 0) return;

        const renderer = chosen ?? fromApp.renderer ?? "markup";
        const started = Date.now();
        const written = await prerender({ root: ctx.root, outputs: ctx.outputs, paths, renderer, warn: (message) => console.warn(message) });
        ctx.log(`prerendered ${String(written)} pages with ${renderer} in ${String(Date.now() - started)} ms`);
      },
    });
  },
});
