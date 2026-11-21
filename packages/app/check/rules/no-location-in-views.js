import { defineRule } from "@lightstart/light/check/define.js";

const LOCATION_PATHNAME = /(?<![.\w$])(?:(?:window|globalThis|self|document)\.)?location\s*\.\s*pathname\b/g;

export default defineRule({
  severity: "error",
  description: "a view asks the app where it is, not the browser",
  why: "`location.pathname` carries the app's base, so comparing it with a route path stops matching once the app lives under one, and it is not the route at all in a test, a prerender or a terminal, where the history is in memory",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!/^src\/views\/.*\.(js|ts)$/.test(file) || /\.test\.(js|ts)$/.test(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      for (const match of source.matchAll(LOCATION_PATHNAME))
        ctx.report({
          file,
          offset: match.index ?? 0,
          message: "read `currentRoute.value?.path` (or `?.name`) from @lightstart/app instead: it is the app path without the base or the query, and it answers wherever the app runs",
        });
    }
  },
});
