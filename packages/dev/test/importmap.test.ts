/**
 * @file Building an importmap from package manifests, merging it with a page's, and reading the
 * map an HTML page already carries.
 */
import { join } from "node:path";
import { importMapFor, importmapFromHtml, mergeImportMaps, packageImports } from "../importmap.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const root = "/w/project";
const app = { name: "app", exports: { ".": "./index.js", "./types": "./src/types.ts", "./*": "./src/*" } };
const dep = { name: "@scope/dep", exports: { ".": { import: "./main.js" }, "./sub": { default: "./sub.js" } } };
const map = importMapFor(root, [
  { dir: root, pkg: app },
  { dir: join(root, "node_modules", "@scope", "dep"), pkg: dep },
]);

eq("the root package's main", map["app"] ?? "", "/index.js");
eq("a root subpath", map["app/types"] ?? "", "/src/types.ts");
eq("a root wildcard", map["app/"] ?? "", "/");
eq("a dependency by its conditional export", map["@scope/dep"] ?? "", "/node_modules/@scope/dep/main.js");
eq("a dependency subpath", map["@scope/dep/sub"] ?? "", "/node_modules/@scope/dep/sub.js");
ok("only the keys the exports name", Object.keys(map).sort().join(",") === ["app", "app/", "app/types", "@scope/dep", "@scope/dep/sub"].sort().join(","));
eqn("a manifest with no name contributes nothing", packageImports(root, root, {}).length, 0);

const merged = mergeImportMaps({ a: "/a.js", b: "/b.js" }, { b: "/page-b.js", c: "/c.js" });
eq("the page's entry wins", merged["b"] ?? "", "/page-b.js");
eq("both maps keep the rest", (merged["a"] ?? "") + " " + (merged["c"] ?? ""), "/a.js /c.js");

const html = '<html><head><script type="importmap">{"imports":{"x":"/x.js","n":1}}</script></head></html>';
const page = importmapFromHtml(html);
eq("the page's importmap is read", page["x"] ?? "", "/x.js");
ok("a non-string target is dropped", page["n"] === undefined);
eqn("a page with no importmap has none", Object.keys(importmapFromHtml("<html></html>")).length, 0);
eqn("malformed JSON is no map", Object.keys(importmapFromHtml('<script type="importmap">{</script>')).length, 0);
done();
