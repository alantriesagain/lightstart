// node-only
/**
 * @file The route API: `currentRoute` follows the same update as `currentView`
 * and `currentParams`, and `href`, `url` and `navigate` take an app path or a
 * route name with its params and query, the base added exactly once.
 */

import { done, eq, ok, throws } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { currentRoute, href, navigate, url } from "../run.ts";
import { openApp } from "../test/index.ts";

const routes = {
  "/": { name: "home", title: "Home", view: "app-home" },
  "/places": { name: "places", title: "Places", view: "app-places" },
  "/places/:id": { name: "place-detail", title: "Place", view: "app-place" },
  "/notes/:slug": { name: "note", title: "Note", view: "app-note" },
  "/search": { name: "search", title: "Search", view: "app-search" },
};

const manifest: AppManifest = {
  app: defineApp({ name: "route-api", host: "web" }),
  models: [],
  controllers: [],
  routes,
  views: [],
};

const based: AppManifest = {
  app: defineApp({ name: "route-api-based", host: "web", url: "https://x.example/budget" }),
  models: [],
  controllers: [],
  routes,
  views: [],
};

const state = (): string =>
  JSON.stringify({
    name: currentRoute.value?.name ?? null,
    path: currentRoute.value?.path ?? null,
    params: currentRoute.value?.params ?? null,
    query: currentRoute.value?.query ?? null,
    view: currentRoute.value?.route.view ?? null,
  });

const main = async (): Promise<void> => {
  ok("currentRoute is null before a run", currentRoute.value === null);
  eq("href answers a path before a run", href("/places/x"), "/places/x");
  eq("href appends a query before a run", href("/places/x", { query: { q: "a b", page: 2 } }), "/places/x?q=a+b&page=2");
  throws("a name before a run throws", () => href("home"), "no route table yet: href(home)");
  throws("url needs an app url or a location", () => url("/places/x"), "url() needs");

  const app = await openApp(manifest);
  try {
    eq(
      "the first route is the matched route",
      state(),
      JSON.stringify({ name: "home", path: "/", params: {}, query: {}, view: "app-home" }),
    );

    navigate("/places/7?tab=info");
    eq(
      "navigate by path fills the route",
      state(),
      JSON.stringify({ name: "place-detail", path: "/places/7", params: { id: "7" }, query: { tab: "info" }, view: "app-place" }),
    );

    navigate("place-detail", { params: { id: "9" }, query: { tab: "map" } });
    eq(
      "navigate by name fills the route",
      state(),
      JSON.stringify({ name: "place-detail", path: "/places/9", params: { id: "9" }, query: { tab: "map" }, view: "app-place" }),
    );

    eq("href fills a name's params", href("place-detail", { params: { id: "3" } }), "/places/3");
    eq("href encodes a space and a slash", href("place-detail", { params: { id: "a b/c" } }), "/places/a%20b%2Fc");
    eq("href appends a name's query", href("search", { query: { q: "a b" } }), "/search?q=a+b");
    throws("a missing param throws naming the route and the param", () => href("place-detail"), "place-detail");
    throws("a missing param throws naming the param", () => href("place-detail"), '"id"');

    await app.stop();
    ok("currentRoute is null after a stop", currentRoute.value === null);
  } finally {
    await app.stop();
  }

  const running = await openApp(based);
  try {
    eq("href adds the base once", href("/places/3"), "/budget/places/3");
    eq("href adds the base once to a name", href("place-detail", { params: { id: "3" } }), "/budget/places/3");
    ok("href carries the base exactly once", href("place-detail", { params: { id: "3" } }).split("/budget").length - 1 === 1);
    eq("url holds the app's origin and base", url("place-detail", { params: { id: "3" } }), "https://x.example/budget/places/3");
    ok("url carries the base exactly once", url("place-detail", { params: { id: "3" } }).split("/budget").length - 1 === 1);

    navigate("place-detail", { params: { id: "4" } });
    eq(
      "navigate by name lands on the app path",
      state(),
      JSON.stringify({ name: "place-detail", path: "/places/4", params: { id: "4" }, query: {}, view: "app-place" }),
    );
    eq("the history holds the base once", String(running.run.router?.adapter.getLocation().pathname), "/budget/places/4");
  } finally {
    await running.stop();
  }

  done();
};

await main();
