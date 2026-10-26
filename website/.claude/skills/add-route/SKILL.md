---
name: add-route
description: Add a screen to the project's routes.js
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from bootstrapp/router/skills/add-route.md. Edit the source, then run `bootstrapp types`. -->

# Add a route

Every app declares its route table in a root `routes.js`, default-exporting `defineRoutes(routes, defaults?)`. Routes are auto-loaded and registered before the router compiles; there is nothing to import.

## Steps

1. **Add the entry** to `routes.js`. A `component` tag string is the house default; path and query params spread onto the element as `.prop` bindings.
2. **Create the view** if it does not exist (`bootstrapp new:view <name>`).
3. **Regenerate types**: `bootstrapp types` (the route names and paths type `$APP.Router.go()` through `.bootstrapp/routes.d.ts`).

## Shape

```js
import { defineRoutes } from "bootstrapp/router";

export default defineRoutes({
  "/": { name: "home", title: "light-website", component: "docs-home" },
  "/workouts/:slug": { name: "workout", title: "Workout", component: "docs-workout", template: null },
  "/library": { name: "library", title: "Library", component: "docs-library" },
}, { template: "template-app" });
```

- The second argument spreads under every entry; a route's own fields win, and `template: null` opts a full-bleed screen out of the shell.
- A param named `:id` would set the element's DOM id; use `:slug` or another name and declare the prop on the view.
- `?category=x` on a route spreads as `.category` too.
- A render function (`component: (params) => html\`...\``) is for what a tag string cannot say.
- `defaults.localized: true` expands locale variants from `manifest.i18n.locales`.

## Rules

- One route per path (`serve/duplicate-route-path`); `routes.js` must default-export (`router/routes-default-export`).
- Navigation from code: `$APP.Router.go("/path")`; links through `<lc-link>` or `$APP.Router.href(path)` (`router/unbased-internal-href`).
- Reference: `projects/bboxe/routes.js`, `examples/centavo/routes.js`, `framework/router/README.md`.
