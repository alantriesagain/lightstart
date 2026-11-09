# @lightstart/router

A client router. It matches `/`-separated route patterns without `URLPattern`, keeps a navigation stack over a browser or memory adapter, localizes paths, builds URLs, follows redirects and actions, and exposes light's `Navigation` contract. The core is platform-neutral and compiles with scriptc; the browser pieces stay at the edges.

## Entries

| Entry | Holds |
|---|---|
| `@lightstart/router` | `createRouter`, `createMemoryRouter`, `createPlatformRouter`, `RouterCore`, the matcher, the adapters, the click helpers, the locale and URL helpers |
| `@lightstart/router/core` | `RouterCore` |
| `@lightstart/router/matcher` | `flattenRoutes`, `compileRoutes`, `matchRoute`, `RouteTable`, `RouteEntry`, `MatchedRoute`, `createPatternString` |
| `@lightstart/router/adapters/browser` | `createBrowserAdapter` |
| `@lightstart/router/adapters/memory` | `createMemoryAdapter` |
| `@lightstart/router/click` | `interceptedPath` |
| `@lightstart/router/listen` | `listen` |
| `@lightstart/router/locale` | `localeOfPath`, `stripLocale`, `withLocale` |
| `@lightstart/router/url` | `normalizeBasePath`, `withBase`, `stripBase`, `withQuery` |

## Quick start

```javascript
import { createRouter, createBrowserAdapter } from "@lightstart/router";

const router = createRouter(createBrowserAdapter(), {
  routes: {
    "/": { name: "home", title: "Home" },
    "/about": { name: "about", title: "About" },
    "/post/:slug": { name: "post", title: "Post" },
    "/settings": {
      name: "settings",
      routes: { "/profile": { name: "settings-profile" } },
    },
  },
  appName: "My App",
});

router.go("about");
router.go("post", { slug: "hello-world" });
```

A route value may also be a bare function. The router keeps it as `{ component: fn }` and never calls it; rendering belongs to the app.

## Route syntax and precedence

A pattern is `/`-separated segments. A segment is a literal, a `:name` parameter that matches one non-empty segment, or a trailing wildcard. A trailing `:rest*` matches the rest of the path, which may be empty, so `/admin/:rest*` answers `/admin` and `/admin/a/b`. A bare trailing `*` is accepted too.

`namedParams` adds optional trailing pairs. A route `/post/:slug` with `namedParams: ["tab", "sort"]` also matches `/post/x/tab/y`, `/post/x/sort/z` and `/post/x/tab/y/sort/z`. Each pair is optional and the pairs keep their declared order.

Precedence is literal before parameter before wildcard, and deeper before shallower. It does not depend on the order the routes were declared in. A pattern with no dynamic part is answered by one `Map` lookup; the rest go through a segment trie.

Nested `routes` flatten relative to their parent. A match on a nested path answers the parent config in `route`, the inner config in `matched.route`, and the child's name in `name`.

## Options

| Option | Meaning |
|---|---|
| `appName` | Suffixes the document title |
| `basePath` | The deploy prefix stripped from matches and added to `href`, `url`, push and replace |
| `locales` | The locale tags the app ships |
| `defaultLocale` | The locale that carries no path prefix |
| `origin` | What `url()` builds on, else the adapter's location origin |
| `prerendered()` | Answers whether the page is prerendered; no title is set while it does |
| `clearPrerendered()` | Clears the prerender state before a client navigation |
| `track(work, label)` | Counts the next-frame work of a route change under `router:<path>` |
| `beforeNavigate(path, matched)` | Early navigation hook; true means it handled the navigation and the router stops |
| `onRouteChange(route)` | Called after every route change |
| `onTitleChange(title)` | Called after every title change |
| `plugins` | Functions that receive the router; their returned members are merged onto it by the convenience constructors |

`isProduction` and `navigation` remain on the options for the app's own `beforeNavigate` rule. The router itself no longer hard-navigates.

## Adapters

An adapter supplies `getLocation()`, `isSamePath(path)`, `hardNavigate(path)`, `pushState(state, path)`, `replaceState(state, path)`, `back()`, `forward()`, `setTitle(title)`, and optionally `clearPrerendered()`.

`createBrowserAdapter()` reads `window.location`, `window.history` and `document.title`. `createMemoryAdapter(initialPath)` keeps its location and history in fields, for tests, server rendering and native apps, and exposes `getHistory()`.

## The Navigation bridge

`router.navigation` satisfies light's `Navigation`: `href(path)`, `go(path)`, `click(event, options)`, `path()` and `subscribe(fn)`. `path()` is the locale-stripped route path. Wire it up with:

```javascript
import { configureNavigation } from "@lightstart/light/navigation";

configureNavigation(router.navigation);
```

`router.click(event)` uses `interceptedPath`, so it walks `composedPath()` for the anchor rather than reading `event.currentTarget`. It skips modified clicks, links with `target`, `download`, `data-no-router` or `rel="external"`, other origins, and same-page hash links. `listen(document, router)` installs the document click interceptor and returns its teardown.

## Work tracking

The router loads nothing from light. A host that counts work passes `track`:

```javascript
import { trackWork } from "@lightstart/light/view/core";
import { createRouter } from "@lightstart/router";

const router = createRouter(adapter, { routes, track: trackWork });
```

After each route change the core calls `track` with the next-frame promise and `router:<path>`. Without `track`, route changes wait for nothing.

## Logging

What the router recovers from (a route not found, a named route or param missing, a duplicate name) and what fails (a subscriber that threw) goes to a `Logger`, which writes to the console with a `[router]` prefix. A host sends it elsewhere with a subclass of `Logger`, passed as `logger` to the constructors or set with `router.logTo(logger)`. A test reads it back from a `MemoryLogger`, whose `lines` hold `"warn: …"` and `"error: …"` entries.

## Differences from Bootstrapp's router

- No `URLPattern`. Matching uses the segment matcher described above, so it compiles with scriptc.
- Precedence is literal, then parameter, then wildcard at every depth. Bootstrapp sorts by segment count and takes the first pattern that matches, so between patterns of the same depth the one declared first wins: `/post/*` declared before `/post/new` answers `/post/new` with the wildcard. Here the literal wins in either order.
- The matcher does not compute `component` or `template`. Route configs keep those fields untouched, and the app decides what to render.
- `subscribe` is the only change signal. There is no `ROUTER_CHANGED` event.
- The MPA hard-navigation branch is the generic `beforeNavigate` hook.
- `url()` reads an `origin` option instead of a site-origin global.
- The prerender flag is an option, never a window global.
- Plugin members are merged by `createRouter` and `createMemoryRouter` in `app.ts`, keeping `Object.assign` out of the native core.
