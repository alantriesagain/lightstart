/**
 * @file The static plugin over a temp folder, through the memory adapter: a file with its type,
 * its ETag, `last-modified` and `cache-control`; a folder's `index.html`; a path with `.html`
 * added; the single-page fallback for an extensionless path and never for a missing asset; a 304
 * for a matching `if-none-match` and for a current `if-modified-since`; a `.br` neighbour for a
 * client that accepts it; a large file streamed with its length; parent folders, encoded ones, a
 * NUL byte and dotfiles refused; a prefix; a more specific route winning over the files.
 * Runs under node and natively; the outputs must be identical.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../app.ts";
import { text } from "../reply.ts";
import { bodyOf, request } from "../memory/index.ts";
import { Static } from "../plugins/static.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const root = mkdtempSync(join(tmpdir(), "light-static-"));
mkdirSync(join(root, "docs"), { recursive: true });
mkdirSync(join(root, ".git"), { recursive: true });
writeFileSync(join(root, "index.html"), "<h1>home</h1>");
writeFileSync(join(root, "app.js"), "export const x = 1;");
writeFileSync(join(root, "app.js.br"), "BROTLI");
writeFileSync(join(root, "about.html"), "<h1>about</h1>");
writeFileSync(join(root, "docs", "index.html"), "<h1>docs</h1>");
writeFileSync(join(root, ".env"), "SECRET=1");
writeFileSync(join(root, ".git", "config"), "[core]");
writeFileSync(join(root, "big.bin"), "x".repeat(300000));
writeFileSync(join(root, "data.json"), "{\"a\":1}");

const main = async (): Promise<void> => {
  const site = new App()
    .get("/api/hello", () => text("from a route"))
    .plugin(new Static({ root, spa: "index.html", cacheControl: "public, max-age=60" }));

  const js = await request(site, "GET", "/app.js");
  eq("a file with its type", String(js.status) + " " + (js.headers.get("content-type") ?? "") + " " + (await bodyOf(js)), "200 text/javascript; charset=utf-8 export const x = 1;");
  const etag = js.headers.get("etag") ?? "";
  ok("a weak ETag", etag.startsWith("W/\""));
  ok("last-modified", (js.headers.get("last-modified") ?? "").endsWith("GMT"));
  eq("the cache-control configured", js.headers.get("cache-control") ?? "", "public, max-age=60");
  eq("the root is its index.html", await bodyOf(await request(site, "GET", "/")), "<h1>home</h1>");
  eq("a folder is its index.html", await bodyOf(await request(site, "GET", "/docs/")), "<h1>docs</h1>");
  eq("a folder without the slash too", await bodyOf(await request(site, "GET", "/docs")), "<h1>docs</h1>");
  eq("a path with .html added", await bodyOf(await request(site, "GET", "/about")), "<h1>about</h1>");
  eq("an extensionless path falls back to the spa file", await bodyOf(await request(site, "GET", "/settings/profile")), "<h1>home</h1>");
  eqn("a missing asset is a 404, never the spa file", (await request(site, "GET", "/missing.png")).status, 404);
  eq("a more specific route wins over the files", await bodyOf(await request(site, "GET", "/api/hello")), "from a route");

  eqn("a matching if-none-match is a 304", (await request(site, "GET", "/app.js", { headers: { "if-none-match": etag } })).status, 304);
  eqn("a current if-modified-since is a 304", (await request(site, "GET", "/data.json", { headers: { "if-modified-since": new Date(Date.now() + 60000).toUTCString() } })).status, 304);
  eqn("a stale one is the file", (await request(site, "GET", "/data.json", { headers: { "if-modified-since": "Thu, 01 Jan 1970 00:00:00 GMT" } })).status, 200);

  const br = await request(site, "GET", "/app.js", { headers: { "accept-encoding": "gzip, br" } });
  eq("a .br neighbour for a client that accepts it", (br.headers.get("content-encoding") ?? "") + " " + (br.headers.get("vary") ?? "") + " " + (await bodyOf(br)), "br Accept-Encoding BROTLI");
  eq("keeping the original's type", br.headers.get("content-type") ?? "", "text/javascript; charset=utf-8");

  const big = await request(site, "GET", "/big.bin");
  ok("a large file is streamed", big.stream !== null && big.bytes === null);
  eq("with its length", big.headers.get("content-length") ?? "", "300000");
  eqn("all of it", (await bodyOf(big)).length, 300000);

  eqn("a parent folder is refused", (await request(site, "GET", "/../etc/passwd")).status, 404);
  eqn("an encoded one too", (await request(site, "GET", "/%2e%2e/%2e%2e/etc/passwd")).status, 404);
  eqn("a NUL byte too", (await request(site, "GET", "/app.js%00.png")).status, 404);
  eqn("a dotfile is refused", (await request(site, "GET", "/.env")).status, 404);
  eqn("and a dot folder", (await request(site, "GET", "/.git/config")).status, 404);

  const plain = new App().plugin(new Static({ root, precompressed: false, typeOf: (path: string) => (path.endsWith(".js") ? "application/x-from-host" : "text/x-other") }));
  const asIs = await request(plain, "GET", "/app.js", { headers: { "accept-encoding": "br" } });
  eq("precompressed: false serves the file as it is", (asIs.headers.get("content-encoding") ?? "none") + " " + (await bodyOf(asIs)), "none export const x = 1;");
  eq("typeOf names the type", asIs.headers.get("content-type") ?? "", "application/x-from-host");

  const assets = new App().plugin(new Static({ root, prefix: "/assets" }));
  eq("under a prefix", await bodyOf(await request(assets, "GET", "/assets/app.js")), "export const x = 1;");
  eqn("and nothing outside it", (await request(assets, "GET", "/app.js")).status, 404);
  eqn("no spa fallback unless asked", (await request(assets, "GET", "/assets/settings")).status, 404);
  rmSync(root, { recursive: true, force: true });
  done();
};

main();
