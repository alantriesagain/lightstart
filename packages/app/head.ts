/**
 * @file The page head on screen: its title, description, social image, path
 * and the app's display title. A route change resets it from the route; a view
 * patches what only its data knows with `pageHead`. The web host follows it
 * into `document.title` and the head tags, and the markup renderer reads it
 * after its page settles.
 */

import { signal } from "@lightstart/light/signals";
import type { App } from "./index.ts";

/** What a view may set for its page's head; a field it leaves out keeps the route's value. */
export interface PageHead {
  /** The page's own title, before the app's title is appended. */
  title?: string;
  /** The page's description, for search engines and link previews. */
  description?: string;
  /** The page's social image, absolute or relative to the app's `url`. */
  image?: string;
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
}

const EMPTY: Head = { title: "", description: "", image: "", path: "/", appTitle: "", namedTitle: false, url: "" };

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
  const config = typeof route === "object" && route !== null ? (route as { title?: unknown; description?: unknown }) : {};
  currentHead.value = {
    title: textOf(config.title, params),
    description: textOf(config.description, params),
    image: "",
    path: path === "" ? "/" : path,
    appTitle: app.title ?? app.name,
    namedTitle: app.title !== undefined,
    url: app.url ?? "",
  };
};

/** Set the head of a run without routes: the app's title alone. */
export const setAppHead = (app: App): void => {
  currentHead.value = { ...EMPTY, appTitle: app.title ?? app.name, namedTitle: app.title !== undefined, url: app.url ?? "" };
};

/** Patch the current page's head; a field left out keeps the route's value until the next route change. */
export const pageHead = (head: PageHead): void => {
  const current = currentHead.peek();
  currentHead.value = {
    ...current,
    title: head.title ?? current.title,
    description: head.description ?? current.description,
    image: head.image ?? current.image,
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
