import { defineRule } from "@lightstart/light/check/define.js";
import ts from "@lightstart/light/check/parse/typescript.js";
import { isRoutesFile, routeKey, routesTable } from "../routes.js";

export default defineRule({
  severity: "error",
  description: "src/routes.(js|ts) default-exports a table whose keys are paths starting with /",
  why: "the router reads each key as a path, so a table exported some other way, or a key that is not a path, leaves a route the app never matches",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!isRoutesFile(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      const parsed = routesTable(source, file);
      if (!parsed) {
        ctx.report({ file, offset: 0, message: `${file} default-exports no routes table; export an object literal of path to route` });
        continue;
      }
      for (const member of parsed.table.properties) {
        if (ts.isSpreadAssignment(member)) continue;
        const key = routeKey(member);
        if (!key) {
          ctx.report({ file, offset: member.getStart(parsed.sf), message: "a routes table key is a string path starting with \"/\"" });
          continue;
        }
        if (!key.name.startsWith("/"))
          ctx.report({ file, offset: key.offset, message: `route "${key.name}" is not a path; a routes table key starts with "/"` });
      }
    }
  },
});
