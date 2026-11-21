// node-only
/**
 * @file The page scanner and rewriter: the importmap, an external and an inline module script, and
 * a stylesheet link are found and replaced; a remote script or stylesheet and everything else
 * stay byte for byte.
 */
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
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

const rooted = parsePage('<link rel="stylesheet" href="/src/styles.css"><script type="module" src="/.light/main.ts"></script><script type="module" src="//cdn.example/x.js"></script>', "/site/docs", "/site");
eq("a src from the site's root resolves against the root", rooted.modules[0]?.kind === "external" ? rooted.modules[0].path : "", "/site/.light/main.ts");
eq("and so does an href", rooted.stylesheets[0]?.path ?? "", "/site/src/styles.css");
eqn("a protocol-relative src is not the build's: it is left out of the scan", rooted.modules.length, 1);

const fonts = '<link rel="stylesheet" href="https://fonts.example/css2?family=Manrope"><link rel="stylesheet" href="/src/styles.css"><script type="module" src="https://cdn.example/x.js"></script>';
const remote = parsePage(fonts, "/site", "/site");
eqn("a remote stylesheet is not bundled", remote.stylesheets.length, 1);
eq("the local one still is", remote.stylesheets[0]?.path ?? "", "/site/src/styles.css");
eqn("a remote module script is not bundled", remote.modules.length, 0);
const kept = renderPage(remote, [], ["./style-0.css"]);
ok("the remote links stay on the page as written", kept.includes('href="https://fonts.example/css2?family=Manrope"') && kept.includes('src="https://cdn.example/x.js"'));
ok("the local stylesheet points at its output", kept.includes('href="./style-0.css"'));
done();
