/**
 * @file The page head on screen: its title, description, social image, path
 * and the app's display title. A route change resets it from the route; a view
 * patches what only its data knows with `pageHead`. The web host follows it
 * into `document.title` and the head tags, and the markup renderer reads it
 * after its page settles.
 */

import { signal } from "@lightstart/light/signals";
import { stripLocale, withLocale } from "@lightstart/router/locale";
import type { App } from "./index.ts";

/** What a view may set for its page's head; a field it leaves out keeps the route's value. */
export interface PageHead {
  /** The page's own title, before the app's title is appended. */
  title?: string;
  /** The page's description, for search engines and link previews. */
  description?: string;
  /** The page's social image, absolute or relative to the app's `url`. */
  image?: string;
  /** Structured data written as one or more `<script type="application/ld+json">` blocks. */
  jsonLd?: unknown;
}

/** The head of the page on screen. */
export interface Head {
  /** The page's own title, before the app's title; empty when it has none. */
  title: string;
  description: string;
  image: string;
  /** The path the head belongs to, from the matched route. */
  path: string;
  /** The app's display title: `defineApp({ title })`, else its `name`. */
  appTitle: string;
  /** Whether `defineApp` named the display title (its separator is ` · `, else ` | `). */
  namedTitle: boolean;
  /** The app's site address, without a trailing slash; empty when it named none. */
  url: string;
  /** The language the page is read in. */
  locale: string;
  /** The path without its locale prefix. */
  routePath: string;
  /** Every language the app ships; a single one when it declares none. */
  locales: readonly string[];
  /** The language that carries no prefix. */
  defaultLocale: string;
  /** Structured data blocks for the page. */
  jsonLd: readonly unknown[];
}

const EMPTY: Head = { title: "", description: "", image: "", path: "/", appTitle: "", namedTitle: false, url: "", locale: "", routePath: "/", locales: [], defaultLocale: "en", jsonLd: [] };

/** The head of the page on screen, which a route change resets and `pageHead` patches. */
export const currentHead = signal<Head>({ ...EMPTY });

const textOf = (value: unknown, params: Record<string, string>): string => {
  if (typeof value === "string") return value;
  if (typeof value !== "function") return "";
  const answer = (value as (given: Record<string, string>) => unknown)(params);
  return typeof answer === "string" ? answer : "";
};

/** Reset the head from the route a navigation matched; a view may patch it during its render. */
export const setRouteHead = (app: App, route: unknown, params: Record<string, string>, path: string): void => {
  const config = typeof route === "object" && route !== null ? (route as { title?: unknown; description?: unknown; locale?: unknown }) : {};
  const pagePath = path === "" ? "/" : path;
  currentHead.value = {
    title: textOf(config.title, params),
    description: textOf(config.description, params),
    image: "",
    path: pagePath,
    appTitle: app.title ?? app.name,
    namedTitle: app.title !== undefined,
    url: app.url ?? "",
    locale: typeof config.locale === "string" && config.locale !== "" ? config.locale : app.locale,
    routePath: stripLocale(pagePath, app.locales),
    locales: app.locales,
    defaultLocale: app.locale,
    jsonLd: [],
  };
};

/** Set the head of a run without routes: the app's title alone. */
export const setAppHead = (app: App): void => {
  currentHead.value = { ...EMPTY, appTitle: app.title ?? app.name, namedTitle: app.title !== undefined, url: app.url ?? "", locale: app.locale, locales: app.locales, defaultLocale: app.locale };
};

/** Patch the current page's head; a field left out keeps the route's value until the next route change. */
export const pageHead = (head: PageHead): void => {
  const current = currentHead.peek();
  const jsonLd = head.jsonLd === undefined ? current.jsonLd : Array.isArray(head.jsonLd) ? head.jsonLd : [head.jsonLd];
  currentHead.value = {
    ...current,
    title: head.title ?? current.title,
    description: head.description ?? current.description,
    image: head.image ?? current.image,
    jsonLd,
  };
};

/** The document title of a head: the home page or a page without a title is the app's title alone. */
export const documentTitleOf = (head: Head): string => {
  const appTitle = head.appTitle;
  if (head.namedTitle) {
    if (head.path === "/" || head.title === "") return appTitle;
    return `${head.title} · ${appTitle}`;
  }
  if (head.title === "") return appTitle;
  return `${head.title} | ${appTitle}`;
};

/** The head's image made absolute against the app's `url` when it is relative. */
export const absoluteImageOf = (head: Head): string => {
  if (head.image === "" || head.url === "" || /^[a-z][a-z0-9+.-]*:/i.test(head.image)) return head.image;
  return `${head.url}${head.image.startsWith("/") ? "" : "/"}${head.image}`;
};

/** The absolute address of the head's page, when the app names a `url`. */
export const canonicalOf = (head: Head): string => {
  if (head.url === "") return "";
  return `${head.url}${head.path.startsWith("/") ? "" : "/"}${head.path}`;
};

/** One `link rel="alternate"`: the language and the address of the same page in it. */
export interface AlternateLink {
  hreflang: string;
  href: string;
}

const addressOf = (head: Head, path: string): string => (head.url === "" ? path : `${head.url}${path.startsWith("/") ? "" : "/"}${path}`);

/** The same page in each of the app's languages, plus `x-default` for the default one; empty with one locale. */
export const alternatesOf = (head: Head): AlternateLink[] => {
  if (head.locales.length < 2) return [];
  const links: AlternateLink[] = [];
  for (const locale of head.locales) {
    links.push({ hreflang: locale, href: addressOf(head, withLocale(head.routePath, locale, head.locales, head.defaultLocale)) });
  }
  links.push({ hreflang: "x-default", href: addressOf(head, withLocale(head.routePath, head.defaultLocale, head.locales, head.defaultLocale)) });
  return links;
};
