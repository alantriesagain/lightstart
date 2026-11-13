/**
 * @file Bare specifiers rewritten only where a module imports them.
 */
import { resolveSpecifier, rewriteSpecifiers } from "../rewrite.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const map = {
  "@lightstart/light": "/light/index.js",
  "@lightstart/light/": "/light/",
  plain: "/plain/index.js",
  "plain/": "/plain/",
};

eq("an exact specifier", resolveSpecifier("@lightstart/light", map) ?? "", "/light/index.js");
eq("a scoped subpath", resolveSpecifier("@lightstart/light/html", map) ?? "", "/light/html");
eq("an unscoped subpath", resolveSpecifier("plain/util.js", map) ?? "", "/plain/util.js");
ok("an unknown package maps to nothing", resolveSpecifier("missing", map) === null);

const source = [
  'import { html } from "@lightstart/light";',
  'export * from "@lightstart/light/html";',
  'import "plain/side.js";',
  'const lazy = import("@lightstart/light/lazy.js");',
  'import local from "./local.js";',
  'import remote from "https://example.com/x.js";',
  'const note = "@lightstart/light is a string";',
  'import missing from "not-in-the-map";',
].join("\n");

const out = rewriteSpecifiers(source, map);
ok("a static import", out.includes('from "/light/index.js"'));
ok("a re-export", out.includes('from "/light/html"'));
ok("a side-effect import", out.includes('import "/plain/side.js"'));
ok("a dynamic import", out.includes('import("/light/lazy.js")'));
ok("a relative import is left", out.includes('from "./local.js"'));
ok("a URL is left", out.includes('from "https://example.com/x.js"'));
ok("a plain string is left", out.includes('const note = "@lightstart/light is a string"'));
ok("an unmapped bare specifier is left", out.includes('from "not-in-the-map"'));
eq("an empty map changes nothing", rewriteSpecifiers(source, {}), source);
done();
