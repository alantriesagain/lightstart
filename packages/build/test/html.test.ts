// node-only
/**
 * @file The page scanner and rewriter: the importmap, an external and an inline module script, and
 * a stylesheet link are found and replaced; everything else stays byte for byte.
 */
import { done, eq, eqn, ok } from "@light/test/assert.ts";
import { parsePage, renderPage } from "../html.ts";

const html = `<!DOCTYPE html>
<html>
<head>
  <title>Page</title>
  <script type="importmap">{ "imports": { "@app/": "./src/" } }</script>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <p>Untouched</p>
  <script type="module" src="./app.js"></script>
  <script type="module">import "@app/thing.ts";</script>
</body>
</html>`;

const page = parsePage(html, "/app");
ok("the importmap text", page.importMapText?.includes("@app/") ?? false);
eqn("one module script with a src and one inline", page.modules.length, 2);
eq("the external module resolved from the page", page.modules[0]?.kind === "external" ? page.modules[0].path : "", "/app/app.js");
ok("the inline module keeps its code", page.modules[1]?.kind === "inline" && page.modules[1].code.includes("@app/thing.ts"));
eqn("one stylesheet", page.stylesheets.length, 1);
eq("the stylesheet resolved from the page", page.stylesheets[0]?.path ?? "", "/app/styles/main.css");

const out = renderPage(page, ["./module-0.js", "./module-1.js"], ["./style-0.css"]);
ok("the importmap is gone", !out.includes("importmap"));
ok("the external script points at its bundle", out.includes('<script type="module" src="./module-0.js"></script>'));
ok("the inline script became a bundle", out.includes('<script type="module" src="./module-1.js"></script>'));
ok("the inline code is gone", !out.includes("@app/thing.ts"));
ok("the stylesheet points at its output", out.includes('href="./style-0.css"'));
ok("the rest of the page is unchanged", out.includes('<p>Untouched</p>') && out.startsWith("<!DOCTYPE html>"));
done();
