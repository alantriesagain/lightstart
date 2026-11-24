// node-only
/**
 * @file `pathsOf` in a localized app: each concrete path is listed in every
 * language the app ships, the default bare and the others under `/<lang>`,
 * and a route's `localized: false` keeps one path.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import type { RoutesMap } from "@lightstart/router";
import { pathsOf } from "../node/paths.ts";

const routes: RoutesMap = {
  "/": { name: "home", view: "home" },
  "/about": { name: "about", view: "about" },
  "/raw": { name: "raw", view: "raw", localized: false },
  "/docs": {
    name: "docs",
    view: "docs",
    routes: {
      "/:page": { name: "doc", view: "doc", params: () => [{ page: "intro" }] },
    },
  },
  "/plain": {
    name: "plain",
    layout: "plain-layout",
    localized: false,
    routes: {
      "/child": { name: "plain-child", view: "child" },
    },
  },
};

const expected = ["/", "/about", "/docs", "/docs/intro", "/es", "/es/about", "/es/docs", "/es/docs/intro", "/plain/child", "/pt", "/pt/about", "/pt/docs", "/pt/docs/intro", "/raw"];

const main = async (): Promise<void> => {
  const paths = await pathsOf(routes, { locales: ["en", "pt", "es"], defaultLocale: "en" });
  eq("each locale's concrete paths, sorted", JSON.stringify(paths), JSON.stringify(expected));
  done();
};

await main();
