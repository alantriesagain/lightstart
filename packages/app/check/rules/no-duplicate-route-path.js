import { defineRule } from "@lightstart/light/check/define.js";
import { isRoutesFile, normalisePath, routeKey, routesTable } from "../routes.js";

export default defineRule({
  severity: "error",
  description: "two keys of the routes table never name the same path",
  why: "the router matches one route per path, so two keys that differ only by a trailing slash leave one of them unreachable and the app answering a path its author did not choose",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!isRoutesFile(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      const parsed = routesTable(source, file);
      if (!parsed) continue;
      /** @type {Map<string, string>} */
      const seen = new Map();
      for (const member of parsed.table.properties) {
        const key = routeKey(member);
        if (!key) continue;
        const normal = normalisePath(key.name);
        const first = seen.get(normal);
        if (first !== undefined)
          ctx.report({ file, offset: key.offset, message: `route "${key.name}" duplicates "${first}"; two routes never share a path` });
        else seen.set(normal, key.name);
      }
    }
  },
});
