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
import { stripLocale, withLocale } from "@lightstart/router/locale";
import { normalizeBasePath, withBase } from "@lightstart/router/url";
import { pathToFileURL } from "node:url";
import type { PrerenderRenderer } from "../../index.ts";
import { appOf, generate, infoOf, routesOf, routesPathOf } from "../../node/generate.ts";
import { pathsOf } from "../../node/paths.ts";
import { prerender } from "../../node/prerender.ts";

const HASHED = /-[A-Za-z0-9_-]+\.(?:js|css)$/;

const siteRoot = (url: string, base: string): string => {
  if (base === "") return url;
  try {
    return normalizeBasePath(new URL(url).pathname) === base ? url : `${url}${base}`;
  } catch {
    return `${url}${base}`;
  }
};

const absolute = (url: string, path: string): string => `${url}${path.startsWith("/") ? path : `/${path}`}`;

const sitemapOf = (url: string, paths: readonly string[], locales: readonly string[], defaultLocale: string): string => {
  const concrete = paths.filter((path) => !path.includes(":") && !path.includes("*")).sort();
  const localized = locales.length > 1;
  if (!localized) {
    const entries = concrete.map((path) => `  <url>\n    <loc>${absolute(url, path)}</loc>\n  </url>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  }
  const present = new Map<string, Set<string>>();
  for (const path of concrete) {
    const routePath = stripLocale(path, locales);
    const locale = locales.find((candidate) => withLocale(routePath, candidate, locales, defaultLocale) === path) ?? defaultLocale;
    const group = present.get(routePath) ?? new Set<string>();
    group.add(locale);
    present.set(routePath, group);
  }
  const entries = concrete
    .map((path) => {
      const routePath = stripLocale(path, locales);
      const group = present.get(routePath) ?? new Set<string>();
      const links = locales
        .filter((locale) => group.has(locale))
        .map((locale) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${absolute(url, withLocale(routePath, locale, locales, defaultLocale))}"/>`);
      if (group.has(defaultLocale)) links.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${absolute(url, withLocale(routePath, defaultLocale, locales, defaultLocale))}"/>`);
      return `  <url>\n    <loc>${absolute(url, path)}</loc>\n${links.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`;
};

const headersOf = (base: string, paths: readonly string[]): string => {
  const hashed = paths
    .filter((path) => path !== "worker.js" && HASHED.test(path))
    .map((path) => withBase(base, `/${path}`))
    .sort();
  const rules = [
    ...[...new Set(["/index.html", "/404.html", "/"])].map((path) => withBase(base, path)).sort().map((path) => `${path}\n  Cache-Control: no-cache`),
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
    profile: { description: "Build the app's named profile (defineApp({ profiles }))" },
  },
  async setup(_ctx, args, api) {
    const found = appOf(api.options.root);
    if (found !== null) api.options.base = (await infoOf(found.path)).base;
    const given = args as { prerender?: unknown; renderer?: unknown; profile?: unknown } | undefined;
    const wanted = given?.prerender === true;
    const chosen = given?.renderer === "browser" || given?.renderer === "markup" ? given.renderer : undefined;
    const profile = typeof given?.profile === "string" && given.profile !== "" ? given.profile : undefined;
    api.steps.before("page", {
      name: "app",
      async run(ctx) {
        await generate(ctx.root, { dev: false, profile });
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
          const paths = routes === null ? [] : await pathsOf(routes as RoutesMap, { locales: info.locales, defaultLocale: info.locale });
          const site = siteRoot(info.url, info.base);
          ctx.outputs.set("sitemap.xml", sitemapOf(site, paths, info.locales, info.locale));
          ctx.outputs.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
        }

        ctx.outputs.set("_headers", headersOf(info.base, [...ctx.outputs.keys()]));
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
        const info = await infoOf(app.path);
        const paths = routes === null || routes === undefined ? [] : await pathsOf(routes as RoutesMap, { locales: info.locales, defaultLocale: info.locale });
        if (paths.length === 0) return;

        const renderer = chosen ?? fromApp.renderer ?? "markup";
        const started = Date.now();
        const written = await prerender({ root: ctx.root, outputs: ctx.outputs, paths, renderer, base: ctx.base, warn: (message) => console.warn(message) });
        ctx.log(`prerendered ${String(written)} pages with ${renderer} in ${String(Date.now() - started)} ms`);
      },
    });
  },
});
