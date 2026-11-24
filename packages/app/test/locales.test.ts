// node-only
/**
 * @file URLs per language: an app that ships several locales answers every
 * route in each of them, the default unprefixed and the others under
 * `/<lang>`. `href`, `url` and `navigate` keep the current locale unless one
 * is given, `currentRoute` names its locale and its unprefixed route path, and
 * a `localized: false` route keeps one shape.
 */

import { done, eq, ok, throws } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { currentRoute, href, navigate, url } from "../run.ts";
import { expandRoutes } from "../routes.ts";
import { openApp } from "../test/index.ts";

const routes = {
  "/": { name: "home", title: "Home", view: "app-home" },
  "/places": { name: "places", title: "Places", view: "app-places" },
  "/places/:id": { name: "place", title: "Place", view: "app-place" },
  "/raw": { name: "raw", title: "Raw", view: "app-raw", localized: false },
};

const manifest: AppManifest = {
  app: defineApp({ name: "locales", host: "web", url: "https://loc.example", locale: "en", locales: ["en", "pt", "es"] }),
  models: [],
  controllers: [],
  routes,
  views: [],
};

const state = (): string =>
  JSON.stringify({
    name: currentRoute.value?.name ?? null,
    path: currentRoute.value?.path ?? null,
    routePath: currentRoute.value?.routePath ?? null,
    locale: currentRoute.value?.locale ?? null,
  });

const main = async (): Promise<void> => {
  const expanded = expandRoutes(routes, { locales: ["en", "pt", "es"], defaultLocale: "en" });
  ok("the default keeps its bare path", Object.prototype.hasOwnProperty.call(expanded, "/places"));
  ok("a non-default locale gets a prefixed variant", Object.prototype.hasOwnProperty.call(expanded, "/pt/places"));
  ok("every non-default locale gets one", Object.prototype.hasOwnProperty.call(expanded, "/es/places"));
  ok("a localized: false route gets no variant", !Object.prototype.hasOwnProperty.call(expanded, "/pt/raw"));
  eq("the variant keeps the view", String((expanded["/pt/places"] as { view?: unknown }).view), "app-places");
  eq("the variant carries its locale", String((expanded["/pt/places"] as { locale?: unknown }).locale), "pt");
  eq("the base name still names the default path", String((expanded["/places"] as { name?: unknown }).name), "places");
  eq("a variant is named with its locale", String((expanded["/pt/places"] as { name?: unknown }).name), "places@pt");
  throws("the default locale must be among the locales", () => defineApp({ name: "bad", host: "web", locale: "fr", locales: ["en", "pt"] }), "not among its locales");

  const app = await openApp(manifest);
  try {
    eq("the default route is unprefixed", state(), JSON.stringify({ name: "home", path: "/", routePath: "/", locale: "en" }));
    eq("href on the default page stays bare", href("/places"), "/places");
    eq("href switches locale when asked", href("/places", { locale: "pt" }), "/pt/places");

    navigate("/places");
    eq("a navigation keeps the default locale bare", String(currentRoute.value?.path), "/places");
    eq("the current route names its default locale", String(currentRoute.value?.locale), "en");

    navigate("/pt/places");
    eq("a prefixed navigation matches its variant", state(), JSON.stringify({ name: "places@pt", path: "/pt/places", routePath: "/places", locale: "pt" }));
    eq("href keeps the reader's locale", href("/places"), "/pt/places");
    eq("href keeps a name's params in the reader's locale", href("place", { params: { id: "7" } }), "/pt/places/7");
    eq("href switches back to the default", href("/places", { locale: "en" }), "/places");
    eq("href leaves an explicit prefixed path as written", href("/es/places"), "/es/places");
    eq("url keeps the reader's locale", url("/places"), "https://loc.example/pt/places");

    navigate("place", { params: { id: "9" } });
    eq("navigate by name resolves in the reader's locale", String(currentRoute.value?.path), "/pt/places/9");
    eq("the route path strips the locale", String(currentRoute.value?.routePath), "/places/9");

    navigate("place", { params: { id: "3" }, locale: "es" });
    eq("navigate takes an explicit locale", String(currentRoute.value?.path), "/es/places/3");
    eq("and its locale is the explicit one", String(currentRoute.value?.locale), "es");

    eq("a localized: false route keeps its one shape in a link", href("/raw"), "/raw");
    navigate("/raw");
    eq("a localized: false route keeps its one shape", String(currentRoute.value?.path), "/raw");
    eq("and reads as the default locale", String(currentRoute.value?.locale), "en");
  } finally {
    await app.stop();
  }
  done();
};

await main();
