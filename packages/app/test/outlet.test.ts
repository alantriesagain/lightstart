// node-only
/**
 * @file The host-neutral route resolution `<app-container>` uses: the matched
 * route's chain into drawn levels, the app default layout applying only to the
 * top-level route, `layout: null` opting out, a grouping route skipped but its
 * layout wrapping the next level, route props with a param of the same name
 * winning, and a parameter converted to the type its view declares.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import type { RoutesMap } from "@lightstart/router";
import { compileRoutes, flattenRoutes, matchRoute } from "@lightstart/router/matcher";
import type { MatchedRoute } from "@lightstart/router/matcher";
import { convertParam, leafRoute, resolveOutlet, routeChain, viewOf } from "../outlet.ts";

const routes: RoutesMap = {
  "/": { name: "home", view: "app-home" },
  "/about": { name: "about", view: "app-about", layout: null },
  "/accounts/:id": { name: "account", view: "app-account", props: { id: "fallback", tab: "main" } },
  "/settings": {
    name: "settings",
    layout: "app-settings-layout",
    routes: {
      "/profile": { name: "profile", view: "app-profile" },
      "/billing": { name: "billing", view: "app-billing" },
    },
  },
  "/dashboard": {
    name: "dashboard",
    view: "app-dashboard",
    routes: {
      "/stats": { name: "stats", view: "app-stats", layout: "app-stats-layout" },
    },
  },
  "/group": {
    name: "group",
    routes: {
      "/child": { name: "child", view: "app-child", layout: "app-child-layout" },
      "/bare": { name: "bare", view: "app-bare", layout: null },
    },
  },
};

const table = compileRoutes(flattenRoutes(routes).flatRoutes);

const matched = (path: string): MatchedRoute => {
  const found = matchRoute(table, path);
  if (found === null) throw new Error(`no route for ${path}`);
  return found;
};

const outlet = (path: string, level: number, kind: "root" | "layout", appLayout: string | null = "app-shell") =>
  JSON.stringify(resolveOutlet(matched(path), { level, kind }, appLayout));

const main = (): void => {
  eq("the leaf is the matched view route", String(viewOf(leafRoute(matched("/settings/profile")))), "app-profile");
  eq("the chain runs from the top ancestor to the leaf", routeChain(matched("/dashboard/stats")).map((route) => route.path).join(" > "), "/dashboard > /dashboard/stats");

  eq("the app default layout wraps a top-level route", outlet("/", 0, "root"), '{"layout":"app-shell","view":"app-home","props":{},"level":0}');
  eq("layout: null opts out of the app default", outlet("/about", 0, "root"), '{"layout":null,"view":"app-about","props":{},"level":0}');
  eq("a layout outlet draws its own level's view without a layout", outlet("/", 0, "layout"), '{"layout":null,"view":"app-home","props":{},"level":0}');
  eq("a view at level 0 asks for level 1", outlet("/dashboard/stats", 1, "root"), '{"layout":"app-stats-layout","view":"app-stats","props":{},"level":1}');
  eq("the app default does not apply below the top", outlet("/dashboard/stats", 0, "root"), '{"layout":"app-shell","view":"app-dashboard","props":{},"level":0}');

  eq("a grouping route is skipped and its layout wraps the next view", outlet("/settings/profile", 0, "root"), '{"layout":"app-settings-layout","view":"app-profile","props":{},"level":0}');
  eq("a grouping route's layout outlet draws the view it wraps", outlet("/settings/billing", 0, "layout"), '{"layout":null,"view":"app-billing","props":{},"level":0}');
  eq("a grouping route without a layout leaves the next view's own", outlet("/group/child", 0, "root"), '{"layout":"app-child-layout","view":"app-child","props":{},"level":0}');
  eq("layout: null under a grouping route opts out of the default it passes down", outlet("/group/bare", 0, "root"), '{"layout":null,"view":"app-bare","props":{},"level":0}');
  eq("a grouping route passes the app default to its first view", outlet("/group/child", 0, "root", "app-shell"), '{"layout":"app-child-layout","view":"app-child","props":{},"level":0}');
  eq("the chain's end draws nothing", outlet("/dashboard/stats", 2, "root"), '{"layout":null,"view":null,"props":{},"level":2}');
  ok("a route without the app default has no layout", resolveOutlet(matched("/"), { level: 0, kind: "root" }, null).layout === null);

  eq("a path param wins over a route prop", outlet("/accounts/42", 0, "root"), '{"layout":"app-shell","view":"app-account","props":{"id":"42","tab":"main"},"level":0}');
  const queried = matchRoute(table, "/accounts/42", { tab: "overview" });
  if (queried === null) throw new Error("no route for /accounts/42?tab=overview");
  eq("a query param wins over a route prop", JSON.stringify(resolveOutlet(queried, { level: 0, kind: "root" }, "app-shell")), '{"layout":"app-shell","view":"app-account","props":{"id":"42","tab":"overview"},"level":0}');

  eq("a number param converts to a number", String(convertParam("42", "number")), "42");
  eq("a numeric string that is not finite stays a string", String(convertParam("nope", "number")), "nope");
  eq("a boolean param reads the empty string as true", String(convertParam("", "boolean")), "true");
  eq("a boolean param reads 1 as true", String(convertParam("1", "boolean")), "true");
  eq("a boolean param reads 0 as false", String(convertParam("0", "boolean")), "false");
  eq("a boolean param reads false as false", String(convertParam("false", "boolean")), "false");
  eq("an unknown boolean string stays as given", String(convertParam("yes", "boolean")), "yes");
  eq("another type's param stays a string", String(convertParam("42", "string")), "42");

  done();
};

main();
