/**
 * @file The service worker's pure decisions: which outputs it precaches with
 * the base before each path, the version hash, and which requests it answers
 * from the cache, from the network or not at all.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { MAX_PRECACHE_BYTES, cacheVersion, precacheList, routeOf } from "../worker/logic.ts";

const outputs = new Map<string, Uint8Array | string>([
  ["index.html", "<!doctype html>"],
  ["404.html", "<!doctype html>"],
  ["about/index.html", "<!doctype html>"],
  ["app-ABCDEF12.js", "console.log(1)"],
  ["styles-XYZ123.css", "body{}"],
  ["_headers", "/index.html\n  Cache-Control: no-cache\n"],
  ["robots.txt", "User-agent: *\n"],
  ["sitemap.xml", "<urlset/>"],
  ["sw.js", "old worker"],
]);

const precache = precacheList(outputs, "/app");
eq("the shell and the hashed bundles are precached, sorted, with the base", precache.join(","), "/app/404.html,/app/app-ABCDEF12.js,/app/index.html,/app/styles-XYZ123.css");
ok("a prerendered page waits for a reader to open it", !precache.includes("/app/about/index.html"));
eq("the files the config names (its icons) are precached too", precacheList(new Map([...outputs, ["icons/icon-192.png", "png"], ["logo.png", "png"]]), "", ["/icons/icon-192.png"]).join(","), "/404.html,/app-ABCDEF12.js,/icons/icon-192.png,/index.html,/styles-XYZ123.css");
ok("the worker is not in its own precache", !precache.includes("/app/sw.js"));
ok("the host files are not precached", !precache.some((path) => path.endsWith("_headers") || path.endsWith("robots.txt") || path.endsWith("sitemap.xml")));

const big = new Map<string, Uint8Array | string>([
  ["small-ABCDEF12.js", "x"],
  ["big-ABCDEF12.js", new Uint8Array(MAX_PRECACHE_BYTES + 1)],
]);
eq("an output over the size cap is left out", precacheList(big, "").join(","), "/small-ABCDEF12.js");

const version = cacheVersion(outputs);
ok("the version is a short hex hash", /^[0-9a-f]{8}$/.test(version));
eq("the same outputs keep the version", cacheVersion(new Map(outputs)), version);
const changed = new Map(outputs);
changed.set("app-ABCDEF12.js", "console.log(2)");
ok("a changed output changes the version", cacheVersion(changed) !== version);
const added = new Map(outputs);
added.set("extra-12345678.js", "void 0");
ok("an added output changes the version", cacheVersion(added) !== version);

const origin = "https://example.com";
const list = precacheList(outputs, "/app");
eq("a precached hashed asset is cache-first", JSON.stringify(routeOf({ method: "GET", url: "https://example.com/app/app-ABCDEF12.js", mode: "no-cors" }, origin, list, "/app")), '{"kind":"cache","url":"https://example.com/app/app-ABCDEF12.js"}');
ok("a precached stylesheet is cache-first", JSON.stringify(routeOf({ method: "GET", url: "https://example.com/app/styles-XYZ123.css", mode: "no-cors" }, origin, list, "/app")).includes('"kind":"cache"'));

const navigation = routeOf({ method: "GET", url: "https://example.com/app/about", mode: "navigate" }, origin, list, "/app");
eq("a navigation goes to the network", navigation.kind, "network");
eq("it falls back to the page kept from a visit, its folder's index, then the shell", JSON.stringify(navigation.kind === "network" ? navigation.candidates : []), '["/app/about","/app/about/index.html","/app/index.html"]');
const rootNavigation = routeOf({ method: "GET", url: "https://example.com/app/", mode: "navigate" }, origin, list, "/app");
eq("the app root falls back to its index", JSON.stringify(rootNavigation.kind === "network" ? rootNavigation.candidates : []), '["/app/","/app/index.html"]');
const unknown = routeOf({ method: "GET", url: "https://example.com/app/unknown/page", mode: "navigate" }, origin, list, "/app");
eq("an unknown page still falls back to the shell", JSON.stringify(unknown.kind === "network" ? unknown.candidates : []), '["/app/unknown/page","/app/unknown/page/index.html","/app/index.html"]');

eq("a cross-origin request passes through", routeOf({ method: "GET", url: "https://cdn.example.org/app/app-ABCDEF12.js", mode: "no-cors" }, origin, list, "/app").kind, "pass");
eq("a POST passes through", routeOf({ method: "POST", url: "https://example.com/app/app-ABCDEF12.js", mode: "no-cors" }, origin, list, "/app").kind, "pass");
eq("an uncached asset passes through", routeOf({ method: "GET", url: "https://example.com/app/other.js", mode: "no-cors" }, origin, list, "/app").kind, "pass");
eq("a cached HTML file on a non-navigation passes through", routeOf({ method: "GET", url: "https://example.com/app/404.html", mode: "no-cors" }, origin, list, "/app").kind, "pass");

done();
