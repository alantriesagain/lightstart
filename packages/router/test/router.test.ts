/**
 * @file The router through the memory adapter: the locale and URL helpers, the segment matcher and
 * its precedence, the navigation stack, named routes, redirects, actions, locales, base paths,
 * titles, prerendering, the early-navigation hook, media redirects, the click interceptor and the
 * Navigation bridge. Ported from the router's node:test suite.
 * Runs under node and natively; the outputs must be identical.
 */
import { MemoryAdapter } from "../adapters/memory.ts";
import { interceptedPath } from "../click.ts";
import type { ClickEvent } from "../click.ts";
import { RouterCore } from "../core.ts";
import { MemoryLogger } from "../logger.ts";
import { localeOfPath, stripLocale, withLocale } from "../locale.ts";
import { compileRoutes, flattenRoutes, matchRoute } from "../matcher.ts";
import type { MatchedRoute, RouteTable } from "../matcher.ts";
import type { RouteConfig, RouterAdapter, RouterOptions, RoutesMap } from "../contracts.ts";
import { normalizeBasePath, stripBase, withBase, withQuery } from "../url.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

interface LinkLike {
  tagName: string;
  href: string;
  target: string;
  rel: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  hasAttribute(name: string): boolean;
}

interface AnchorOptions {
  target?: string;
  rel?: string;
  download?: boolean;
  noRouter?: boolean;
}

interface ClickState {
  event: ClickEvent;
  prevented: () => boolean;
}

interface MediaScope {
  matchMedia?: (query: string) => { matches: boolean };
}

class TitleMemoryAdapter extends MemoryAdapter {
  titles: string[] = [];

  setTitle(title: string): void {
    this.titles.push(title);
  }
}

const table = (routes: RoutesMap): RouteTable => compileRoutes(flattenRoutes(routes).flatRoutes);

const logged = new MemoryLogger();

const createMemoryRouter = (options: RouterOptions & { routes?: RoutesMap; initialPath?: string } = {}): RouterCore => {
  const { routes, initialPath, ...rest } = options;
  const router = new RouterCore(new MemoryAdapter(initialPath ?? "/"), { logger: logged });
  if (routes) router.init(routes, rest);
  return router;
};

const createRouter = (adapter: RouterAdapter, options: RouterOptions & { routes?: RoutesMap } = {}): RouterCore => {
  const { routes, ...rest } = options;
  const router = new RouterCore(adapter, { logger: logged });
  if (routes) router.init(routes, rest);
  return router;
};

const testRoutes = (): RoutesMap => {
  const routes: RoutesMap = {
    "/": { name: "home", title: "Home" },
    "/about": { name: "about", title: "About" },
    "/users": { name: "users", title: "Users" },
    "/users/:id": { name: "user-detail", title: "User" },
    "/posts/:slug": { name: "post-detail", title: "Post" },
    "/redirect-test": { name: "redirect-test", redirect: "/" },
    "/action-test": { name: "action-test", action: () => "action-called" },
  };
  return routes;
};

const json = (value: unknown): string => JSON.stringify(value);

const found = (matched: MatchedRoute | null): MatchedRoute => {
  if (matched === null) throw new Error("no match");
  return matched;
};

const anchor = (href: string, options: AnchorOptions = {}): LinkLike => {
  const url = new URL(href, "http://memory");
  return {
    tagName: "A",
    href: url.href,
    target: options.target ?? "",
    rel: options.rel ?? "",
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    hasAttribute: (name: string): boolean =>
      (name === "download" && options.download === true) || (name === "data-no-router" && options.noRouter === true),
  };
};

const clickEvent = (link: unknown, overrides: Partial<ClickEvent> = {}): ClickState => {
  let prevented = false;
  const event: ClickEvent = {
    defaultPrevented: overrides.defaultPrevented ?? false,
    button: overrides.button ?? 0,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    altKey: overrides.altKey ?? false,
    composedPath: overrides.composedPath ?? ((): unknown[] => [link]),
    preventDefault: overrides.preventDefault ?? ((): void => {
      prevented = true;
    }),
  };
  return { event, prevented: (): boolean => prevented };
};

const setMatchMedia = (fn: ((query: string) => { matches: boolean }) | undefined): void => {
  (globalThis as unknown as MediaScope).matchMedia = fn;
};

const main = (): void => {
  const locales = ["en", "pt-BR"];

  eq("locale reads a declared prefix", String(localeOfPath("/pt-BR/places/x", locales)), "pt-BR");
  eq("locale reads a bare prefix", String(localeOfPath("/pt-BR", locales)), "pt-BR");
  eq("locale reads a prefix before a query", String(localeOfPath("/pt-BR?d=1", locales)), "pt-BR");
  eq("no prefix in a plain path", String(localeOfPath("/places/x", locales)), "null");
  eq("an undeclared prefix is none", String(localeOfPath("/es/places", locales)), "null");
  eq("a prefix strips with query and hash", stripLocale("/pt-BR/places/x?d=1#a", locales), "/places/x?d=1#a");
  eq("a bare prefix strips to root", stripLocale("/pt-BR", locales), "/");
  eq("a path takes a locale prefix", withLocale("/places/x", "pt-BR", locales, "en"), "/pt-BR/places/x");
  eq("root takes a locale prefix", withLocale("/", "pt-BR", locales, "en"), "/pt-BR");
  eq("the default locale carries no prefix", withLocale("/pt-BR/places", "en", locales, "en"), "/places");
  eq("an absolute URL is left alone", withLocale("https://x.y/places", "pt-BR", locales, "en"), "https://x.y/places");

  eq("an undefined base normalizes to none", normalizeBasePath(undefined), "");
  eq("a base gains a leading slash and loses its trailing one", normalizeBasePath("budget/"), "/budget");
  eq("a base prefixes a path", withBase("/budget", "/x.js"), "/budget/x.js");
  eq("a base is not added twice", withBase("/budget", "/budget/x.js"), "/budget/x.js");
  eq("a protocol-relative path is left alone", withBase("/budget", "//cdn.test/x.js"), "//cdn.test/x.js");
  eq("a base strips from a path", stripBase("/budget", "/budget/x.js"), "/x.js");
  eq("a query is appended and encoded", withQuery("/join", { next: "/profile" }), "/join?next=%2Fprofile");
  eq("an empty query value is dropped", withQuery("/join", { empty: "" }), "/join");

  const flattenedRoutes: RoutesMap = {
    "/": { name: "home" },
    "/users": { name: "users", routes: { "/:id": { name: "user-detail" } } },
  };
  const flat = flattenRoutes(flattenedRoutes);
  eq("a named route maps to its path", String(flat.namedRoutes.get("home")), "/");
  eq("a nested named route maps to its full path", String(flat.namedRoutes.get("user-detail")), "/users/:id");
  let child: RouteConfig | null = null;
  for (const entry of flat.flatRoutes) if (entry.path === "/users/:id") child = entry.route;
  eq("a flattened child points at its parent", String(child?.parent?.name), "users");

  const nestedRoutes: RoutesMap = { "/parent": { name: "parent", routes: { "/child": { name: "child" } } } };
  const nested = table(nestedRoutes);
  const nestedMatched = found(matchRoute(nested, "/parent/child"));
  eq("a nested match names the child", String(nestedMatched.name), "child");
  eq("and answers the parent config", String(nestedMatched.route.name), "parent");
  eq("with the inner match in matched", String(nestedMatched.matched?.route.name), "child");

  const precedenceTables: RoutesMap[] = [
    { "/post/new": { name: "new" }, "/post/:slug": { name: "slug" }, "/post/*": { name: "wild" } },
    { "/post/*": { name: "wild" }, "/post/:slug": { name: "slug" }, "/post/new": { name: "new" } },
    { "/post/:slug": { name: "slug" }, "/post/*": { name: "wild" }, "/post/new": { name: "new" } },
  ];
  for (const entries of precedenceTables) {
    const routes = table(entries);
    eq("a literal beats a parameter and a wildcard", String(found(matchRoute(routes, "/post/new")).name), "new");
    eq("a parameter beats a wildcard", String(found(matchRoute(routes, "/post/x")).name), "slug");
    eq("a wildcard takes the rest", String(found(matchRoute(routes, "/post/x/y")).name), "wild");
  }

  const optionalRoutes: RoutesMap = { "/post/:slug": { name: "post", namedParams: ["tab", "sort"] } };
  const optional = table(optionalRoutes);
  eq("an optional pair is absent", String(found(matchRoute(optional, "/post/x")).name), "post");
  eq("no optional params means only the slug", json(found(matchRoute(optional, "/post/x")).params), json({ slug: "x" }));
  eq("the first optional pair matches", json(found(matchRoute(optional, "/post/x/tab/y")).params), json({ slug: "x", tab: "y" }));
  eq("the second optional pair matches alone", json(found(matchRoute(optional, "/post/x/sort/z")).params), json({ slug: "x", sort: "z" }));
  eq("both optional pairs match in order", json(found(matchRoute(optional, "/post/x/tab/y/sort/z")).params), json({ slug: "x", tab: "y", sort: "z" }));
  eq("a pair out of order does not match", String(matchRoute(optional, "/post/x/other/y")), "null");

  const wildcard = table({ "/admin/:rest*": { name: "admin" } });
  eq("a wildcard matches its bare prefix", json(found(matchRoute(wildcard, "/admin")).params), json({ rest: "" }));
  eq("a wildcard takes the rest of the path", json(found(matchRoute(wildcard, "/admin/a/b")).params), json({ rest: "a/b" }));
  eq("a wildcard does not match a longer sibling", String(matchRoute(wildcard, "/administrator")), "null");
  const bare = table({ "/files/*": { name: "files" } });
  eq("a bare wildcard matches its prefix", json(found(matchRoute(bare, "/files")).params), json({ "*": "" }));
  eq("a bare wildcard takes the rest", json(found(matchRoute(bare, "/files/a/b")).params), json({ "*": "a/b" }));

  const deeper = table({ "/files/*": { name: "wild" }, "/files/:name/edit": { name: "edit" } });
  eq("a deeper parameter route beats a shallower wildcard", String(found(matchRoute(deeper, "/files/a/edit")).name), "edit");
  eq("the wildcard answers the rest", String(found(matchRoute(deeper, "/files/a/other")).name), "wild");

  const adapter = new MemoryAdapter("/test?query=1#hash");
  eq("a memory adapter keeps its path", adapter.getLocation().pathname, "/test");
  eq("a memory adapter keeps its query", adapter.getLocation().search, "?query=1");
  eq("a memory adapter keeps its hash", adapter.getLocation().hash, "#hash");
  adapter.pushState({}, "/page1");
  adapter.pushState({}, "/page2");
  eq("back reports a move", adapter.back() === true ? "true" : "false", "true");
  eq("back lands on the previous path", adapter.getLocation().pathname, "/page1");
  eq("forward reports a move", adapter.forward() === true ? "true" : "false", "true");
  eq("forward lands on the next path", adapter.getLocation().pathname, "/page2");
  adapter.back();
  adapter.pushState({}, "/page3");
  eq("a push after back truncates forward", adapter.forward() === true ? "true" : "false", "false");
  eqn("the history keeps the truncated entries", adapter.getHistory().entries.length, 2);

  let router = createMemoryRouter({ routes: testRoutes() });
  const initial = createMemoryRouter({ routes: testRoutes(), initialPath: "/about" });
  eq("the initial path sets the route", String(initial.currentRoute?.name), "about");
  ok("compiling routes answers entries", initial.routes.length > 0);
  ok("every route pattern starts at the root", initial.routes[0].pattern.startsWith("/"));
  eq("a trailing slash normalizes away", router.normalizePath("/about/"), "/about");
  eq("a query and hash normalize away", router.normalizePath("/about?query=1#hash"), "/about");

  router.go("/about");
  eq("a path navigates", String(router.currentRoute?.name), "about");
  router.go("user-detail", { id: "123" });
  eq("a named route fills its param", String(router.currentRoute?.params.id), "123");
  router.go("/posts/hello?page=2&slug=ignored");
  eq("a path param beats a query param of the same name", String(router.currentRoute?.params.slug), "hello");
  eq("the other query params stay", String(router.currentRoute?.params.page), "2");

  eq("a named route creates its path", String(router.create("about")), "/about");
  eq("params fill a named path", String(router.create("user-detail", { id: "456" })), "/users/456");
  eq("extra params become the query", String(router.create("user-detail", { id: "123", tab: "posts" })), "/users/123?tab=posts");
  eq("an unknown name creates nothing", String(router.create("nonexistent")), "null");
  eq("an unknown name is logged", logged.lines[logged.lines.length - 1], "error: Named route not found: nonexistent");

  router.go("/about");
  router.replace("/users");
  eq("replace changes the route", String(router.currentRoute?.name), "users");
  router.go("/redirect-test");
  eq("a redirect follows to its target", String(router.currentRoute?.name), "home");
  router.go("/about");
  router.go("/action-test");
  eq("an action runs without changing the route", String(router.currentRoute?.name), "about");

  router = createMemoryRouter({ routes: testRoutes() });
  router.go("/about");
  router.go("/users");
  eqn("a stack holds each navigation", router.stack.length, 3);
  router.back();
  eq("back changes the route", String(router.currentRoute?.name), "about");
  eqn("back drops an entry", router.stack.length, 2);
  router.forward();
  eq("forward changes the route", String(router.currentRoute?.name), "users");
  router.home();
  eq("home changes the route", String(router.currentRoute?.name), "home");
  eqn("home leaves one entry", router.stack.length, 1);

  const before = router.stack;
  router.go("/about");
  const pushed = router.stack;
  ok("a navigation answers a new stack array", pushed !== before);
  router.setTitle("Renamed");
  ok("a title change answers a new stack array", router.stack !== pushed);
  eq("the new stack carries the title", router.stack[router.stack.length - 1].title, "Renamed");
  eq("the old stack keeps its own title", pushed[pushed.length - 1].title, "About");

  const live = createMemoryRouter({ routes: testRoutes(), initialPath: "/list?platform=discord&page=2" });
  eq("the live query reads the adapter", json(live.query), json({ platform: "discord", page: "2" }));
  live.go("/users?page=3#top");
  eq("the live path is the route path", live.path, "/users");
  eq("the live query follows a navigation", json(live.query), json({ page: "3" }));

  let count = 0;
  const stop = router.subscribe((route: MatchedRoute): void => {
    count++;
    eq("a subscriber sees the new route", String(route.name), "about");
  });
  router.go("/about");
  stop();
  router.go("/users");
  eqn("an unsubscribed listener is not called", count, 1);
  const reported = new MemoryLogger();
  const guarded = createMemoryRouter({ routes: testRoutes() }).logTo(reported);
  guarded.subscribe((): void => {
    throw new Error("subscriber error");
  });
  guarded.go("/about");
  eq("a throwing subscriber is survived", String(guarded.currentRoute?.name), "about");
  eq("what it threw goes to the logger", reported.lines.join(","), "error: Subscriber error: subscriber error");
  let keyed = 0;
  const stopKeyed = router.subscribe("currentRoute", (): void => {
    keyed++;
  });
  router.go("/users");
  stopKeyed();
  eqn("a keyed subscriber is called before it stops", keyed, 1);

  const changed: string[] = [];
  const titleAdapter = new TitleMemoryAdapter("/");
  const titled = createRouter(titleAdapter, {
    routes: testRoutes(),
    appName: "TestApp",
    onTitleChange: (title: string): void => {
      changed.push(title);
    },
  });
  titled.go("/about");
  eq("the title carries the app name", titleAdapter.titles[titleAdapter.titles.length - 1] ?? "", "About | TestApp");
  eq("the title change reports the full title", changed[changed.length - 1] ?? "", "About | TestApp");

  let prerendered = true;
  const prerenderAdapter = new TitleMemoryAdapter("/");
  const app = createRouter(prerenderAdapter, {
    routes: testRoutes(),
    appName: "TestApp",
    prerendered: (): boolean => prerendered,
    clearPrerendered: (): void => {
      prerendered = false;
    },
  });
  eqn("a prerendered page sets no title", prerenderAdapter.titles.length, 0);
  app.go("/about");
  eq("a navigation clears the flag and sets the title", prerenderAdapter.titles[prerenderAdapter.titles.length - 1] ?? "", "About | TestApp");

  const handled: Array<[string, string]> = [];
  const hookedRoutes: RoutesMap = { "/": { name: "home" }, "/places": { name: "places", ssg: true } };
  const hooked = createMemoryRouter({
    routes: hookedRoutes,
    beforeNavigate: (path: string, matched: MatchedRoute): boolean => {
      handled.push([path, String(matched.route.name)]);
      return matched.route.ssg === true;
    },
  });
  handled.splice(0, handled.length);
  hooked.go("/places");
  eq("the early hook sees the path and route", json(handled), json([["/places", "places"]]));
  eq("a handled navigation stops on the old route", String(hooked.currentRoute?.name), "home");

  const titleRoutes: RoutesMap = { "/": { name: "home", title: () => "Home" }, "/places": { name: "places", title: "Places" } };
  const functionTitle = createMemoryRouter({ routes: titleRoutes });
  const initTitle = functionTitle.currentRoute?.route.title;
  eq("a function title is read at init", typeof initTitle === "string" ? initTitle : "", "Home");
  functionTitle.go("/places");
  const nextTitle = functionTitle.currentRoute?.route.title;
  eq("a string title is read at navigation", typeof nextTitle === "string" ? nextTitle : "", "Places");

  const baseRoutes: RoutesMap = {
    "/": { name: "home" },
    "/budget": { name: "budget" },
    "/budgets": { name: "budgets" },
  };
  const based = createMemoryRouter({ routes: baseRoutes, initialPath: "/budget/", basePath: "/budget" });
  eq("the base strips on entry", String(based.currentRoute?.name), "home");
  eq("the base leaves the path at root", based.path, "/");
  eq("href adds the base", based.href("/budgets"), "/budget/budgets");
  based.go("/budgets");
  eq("a navigation writes the base", based.adapter.getLocation().pathname, "/budget/budgets");
  eq("the path strips the base", based.path, "/budgets");
  based.go("/budget/budget");
  eq("the base is not stripped twice on write", based.adapter.getLocation().pathname, "/budget/budget");
  eq("the route matches under the double base", String(based.currentRoute?.name), "budget");
  based.replace("/budgets");
  eq("replace writes the base", based.adapter.getLocation().pathname, "/budget/budgets");

  const boundary = createMemoryRouter({ routes: baseRoutes, initialPath: "/budget/budgets", basePath: "/budget" });
  eq("the base strips on a segment boundary", String(boundary.currentRoute?.name), "budgets");

  const localeRoutes = (): RoutesMap => {
    const routes: RoutesMap = {
      "/": { name: "home", title: () => "Home" },
      "/places": { name: "places", title: "Places" },
      "/places/:slug": { name: "place" },
      "/today": { name: "today", redirect: "/agenda" },
      "/agenda": { name: "agenda" },
      "/pt-BR": { name: "home-pt-BR", title: () => "Início", locale: "pt-BR" },
      "/pt-BR/places": { name: "places-pt-BR", locale: "pt-BR" },
      "/pt-BR/places/:slug": { name: "place-pt-BR", locale: "pt-BR" },
      "/pt-BR/today": { name: "today-pt-BR", redirect: "/agenda", locale: "pt-BR" },
      "/pt-BR/agenda": { name: "agenda-pt-BR", locale: "pt-BR" },
    };
    return routes;
  };
  const boot = (initialPath: string) => createMemoryRouter({ routes: localeRoutes(), initialPath, locales, defaultLocale: "en" });

  const localized = boot("/pt-BR/places");
  eq("the route keeps its locale", String(localized.currentRoute?.route.locale), "pt-BR");
  eq("the route path strips the locale", localized.routePath, "/places");
  eq("href keeps the reader's locale", localized.href("/places/x"), "/pt-BR/places/x");
  eq("href keeps the reader's locale with a query", localized.href("/places/x", { d: 1 }), "/pt-BR/places/x?d=1");
  eq("href keeps an explicit locale already in the path", localized.href("/en/places"), "/en/places");
  eq("href honors an explicit default locale", localized.href("/places/x", undefined, "en"), "/places/x");
  eq("href honors an explicit locale and query", localized.href("/places/x", { d: 1 }, "pt-BR"), "/pt-BR/places/x?d=1");
  localized.go("/agenda");
  eq("a navigation keeps the reader's locale", localized.path, "/pt-BR/agenda");
  localized.replace("/places");
  eq("a replace keeps the reader's locale", localized.path, "/pt-BR/places");
  localized.go("/places/x");
  eq("a localized path fills its param", String(localized.currentRoute?.params.slug), "x");
  eq("the route path strips the locale again", localized.routePath, "/places/x");
  localized.replace("/places/x", undefined, "en");
  eq("a replace honors an explicit locale", localized.path, "/places/x");
  localized.go("/agenda", undefined, "pt-BR");
  eq("a navigation honors an explicit locale", localized.path, "/pt-BR/agenda");
  eq("the locale of a bare path is the default", String(localized.localeOf("/places")), "en");
  eq("the locale of a prefixed path is its own", String(localized.localeOf("/pt-BR/places")), "pt-BR");
  localized.go("/places", undefined, localized.localeOf("/places"));
  eq("navigating with the default locale stays bare", localized.path, "/places");

  const pt = boot("/pt-BR/today");
  eq("a localized redirect lands in its locale", pt.path, "/pt-BR/agenda");
  const en = boot("/today");
  eq("a default-locale redirect lands bare", en.path, "/agenda");
  eq("and its route path is bare", en.routePath, "/agenda");

  const narrow = "(max-width: 1023.98px)";
  setMatchMedia((query: string) => ({ matches: query === narrow }));
  const mediaRoutes: RoutesMap = {
    "/": { name: "home", mediaRedirect: { media: narrow, to: "/map" } },
    "/map": { name: "map" },
    "/pt-BR": { name: "home-pt-BR", locale: "pt-BR", mediaRedirect: { media: narrow, to: "/map" } },
    "/pt-BR/map": { name: "map-pt-BR", locale: "pt-BR" },
  };
  const mediaEn = createMemoryRouter({ routes: mediaRoutes, initialPath: "/?utm=x", locales, defaultLocale: "en" });
  eq("a media redirect fires on page load", String(mediaEn.currentRoute?.route.name), "map");
  eq("the redirect lands on the target", mediaEn.path, "/map");
  eq("the redirect keeps the query", json(mediaEn.query), json({ utm: "x" }));
  const mediaPt = createMemoryRouter({ routes: mediaRoutes, initialPath: "/pt-BR", locales, defaultLocale: "en" });
  eq("a localized media redirect keeps its locale", mediaPt.path, "/pt-BR/map");

  const laterRoutes: RoutesMap = { "/": { name: "home", mediaRedirect: { media: narrow, to: "/map" } }, "/map": { name: "map" } };
  const later = createMemoryRouter({ routes: laterRoutes, initialPath: "/" });
  eq("the page load redirects", String(later.currentRoute?.route.name), "map");
  later.go("/");
  eq("a later navigation does not redirect", String(later.currentRoute?.route.name), "home");
  setMatchMedia(undefined);

  const location = { origin: "https://x.test", pathname: "/here" };
  const link = anchor("https://x.test/places/x?tab=1#review");
  const internal = clickEvent(link, { composedPath: (): unknown[] => [{ tagName: "SPAN" }, link] });
  eq("an internal link is found through composedPath", String(interceptedPath(internal.event, location)), "/places/x?tab=1#review");

  const plain = anchor("https://x.test/places");
  for (const overrides of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }])
    eq("a modified or prevented click is not intercepted", String(interceptedPath(clickEvent(plain, overrides).event, location)), "null");
  eq("a targeted link is not intercepted", String(interceptedPath(clickEvent(anchor("https://x.test/places", { target: "_blank" })).event, location)), "null");
  eq("a download link is not intercepted", String(interceptedPath(clickEvent(anchor("https://x.test/places", { download: true })).event, location)), "null");
  eq("an opted-out link is not intercepted", String(interceptedPath(clickEvent(anchor("https://x.test/places", { noRouter: true })).event, location)), "null");
  eq("an external rel link is not intercepted", String(interceptedPath(clickEvent(anchor("https://x.test/places", { rel: "external" })).event, location)), "null");
  eq("another origin is not intercepted", String(interceptedPath(clickEvent(anchor("https://elsewhere.test/places")).event, location)), "null");
  eq("a same-page hash link is not intercepted", String(interceptedPath(clickEvent(anchor("https://x.test/here#top")).event, location)), "null");

  const clicking = createMemoryRouter({ routes: testRoutes() });
  const routed = clickEvent(anchor("http://memory/users/7"));
  eq("an internal click is handled", clicking.click(routed.event) ? "true" : "false", "true");
  eq("an internal click prevents the browser", routed.prevented() ? "true" : "false", "true");
  eq("an internal click changes the route", String(clicking.currentRoute?.name), "user-detail");
  eq("an internal click fills the route param", String(clicking.currentRoute?.params.id), "7");

  const leaving = createMemoryRouter({ routes: testRoutes() });
  const external = clickEvent(anchor("https://elsewhere.test/places"));
  eq("an external click is left to the browser", leaving.click(external.event) ? "true" : "false", "false");
  eq("an external click does not prevent the browser", external.prevented() ? "true" : "false", "false");

  const bridged = createMemoryRouter({ routes: testRoutes(), initialPath: "/users/1" });
  const bridge = bridged.navigation;
  eq("navigation href is the router href", bridge.href("/about"), "/about");
  eq("navigation path is the route path", bridge.path(), "/users/1");
  let changes = 0;
  const stopBridge = bridge.subscribe((): void => {
    changes++;
  });
  bridge.go("/about");
  stopBridge();
  bridge.go("/users");
  eqn("navigation subscribe stops when asked", changes, 1);
  const bridgeClick = clickEvent(anchor("http://memory/users/9"));
  eq("navigation click is handled", bridge.click(bridgeClick.event) ? "true" : "false", "true");
  eq("navigation click changes the route", String(bridged.currentRoute?.name), "user-detail");

  done();
};

main();
