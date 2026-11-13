// node-only
/**
 * @file The importmap resolver: exact keys, trailing-slash prefixes, the longest prefix, targets
 * relative to the page, and a bare specifier it does not name.
 */
import { done, eq } from "@light/test/assert.ts";
import { parseImportMap, resolveSpecifier } from "../importmap.ts";

const pageDir = "/project/app";
const map = parseImportMap(
  JSON.stringify({
    imports: {
      "@app/core": "./src/core.js",
      "@app/": "./src/",
      "@app/ui/": "./src/ui/",
      "@lib/": "../../shared/lib/",
      "@remote/": "https://cdn.example.com/lib/",
    },
  }),
);

eq("an exact key", resolveSpecifier(map, "@app/core", pageDir) ?? "", "/project/app/src/core.js");
eq("a prefix key", resolveSpecifier(map, "@app/format.js", pageDir) ?? "", "/project/app/src/format.js");
eq("the longest prefix wins", resolveSpecifier(map, "@app/ui/button.js", pageDir) ?? "", "/project/app/src/ui/button.js");
eq("a target relative to the page", resolveSpecifier({ imports: { "@x": "./a/b.js" } }, "@x", "/p") ?? "", "/p/a/b.js");
eq("a target outside the app", resolveSpecifier(map, "@lib/util.js", pageDir) ?? "", "/shared/lib/util.js");
eq("a specifier the map does not name", resolveSpecifier(map, "react", pageDir) ?? "", "");
eq("a remote target is not a local path", resolveSpecifier(map, "@remote/a.js", pageDir) ?? "", "");
done();
