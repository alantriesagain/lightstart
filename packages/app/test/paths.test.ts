// node-only
/**
 * @file `pathsOf` lists the concrete path of every route: a static route is
 * itself, a route with parameters is filled from its `params` (sync or async,
 * each value URL-encoded, an entry missing one skipped), and wildcards,
 * `spa: true` routes and redirects are left out. Nested routes join their
 * parent's path.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import type { RoutesMap } from "@lightstart/router";
import { pathsOf } from "../node/paths.ts";

const routes: RoutesMap = {
  "/": { name: "home", view: "home" },
  "/about": { name: "about", view: "about" },
  "/notes/:id": {
    name: "note",
    view: "note",
    params: () => [{ id: "1" }, { id: "two words" }, { id: "a/b" }, {}],
  },
  "/items/:id": {
    name: "item",
    view: "item",
    params: async () => [{ id: "9" }],
  },
  "/skip/:id": { name: "skip", view: "skip" },
  "/files/*": { name: "files", view: "files" },
  "/draft": { name: "draft", view: "draft", spa: true },
  "/old": { name: "old", view: "old", redirect: "/" },
  "/docs": {
    name: "docs",
    view: "docs",
    routes: {
      "/:page": { name: "doc", view: "doc", params: () => [{ page: "intro" }] },
      "/index": { name: "index", view: "index" },
    },
  },
  "/group": {
    name: "group",
    layout: "group-layout",
    routes: {
      "/child": { name: "group-child", view: "child" },
    },
  },
};

const expected = ["/", "/about", "/docs", "/docs/index", "/docs/intro", "/group/child", "/items/9", "/notes/1", "/notes/a%2Fb", "/notes/two%20words"];

const main = async (): Promise<void> => {
  const paths = await pathsOf(routes);
  eq("every concrete path, sorted and unique", JSON.stringify(paths), JSON.stringify(expected));
  ok("a grouping route with no view is left out", !paths.includes("/group"));
  done();
};

await main();
