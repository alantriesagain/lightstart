import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stage } from "../packages/light/scripts/pack.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "packages", "light");
const PAGES = path.join(HERE, "pages");
const TYPES = { ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".css": "text/css" };

/**
 * Stage the package and map its exports, and nothing else, so a page loads
 * exactly what the package ships.
 * @returns {{ imports: Record<string, string> }}
 */
export const importMap = () => {
  const { manifest } = stage();
  /** @type {Record<string, string>} */
  const imports = {};
  for (const [key, target] of Object.entries(manifest.exports))
    if (typeof target !== "string") imports[key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`] = `/dist/${target.default.slice(2)}`;
  return { imports };
};

/**
 * Serve the package folder, and the benchmark pages under `/bench/`, with the
 * importmap injected where a page carries `<!--importmap-->`.
 * @param {number} [port]
 * @returns {Promise<http.Server>}
 */
export const serve = (port = 0) =>
  new Promise((resolve) => {
    const map = `<script type="importmap">${JSON.stringify(importMap())}</script>`;
    const server = http.createServer((req, res) => {
      const { pathname } = new URL(req.url ?? "/", "http://localhost");
      const file = pathname.startsWith("/bench/") ? path.join(PAGES, pathname.slice(7)) : path.join(ROOT, pathname);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(file, (error, data) => {
        if (error) {
          res.writeHead(404);
          res.end();
          return;
        }
        const body = file.endsWith(".html") ? String(data).replace("<!--importmap-->", map) : data;
        res.writeHead(200, { "content-type": TYPES[/** @type {keyof typeof TYPES} */ (path.extname(file))] ?? "application/octet-stream", "cache-control": "no-store" });
        res.end(body);
      });
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serve(Number(process.argv[2] ?? 4600));
  const address = /** @type {import("node:net").AddressInfo} */ (server.address());
  const pages = fs.readdirSync(PAGES).filter((name) => name.endsWith(".html"));
  console.log(pages.map((name) => `http://127.0.0.1:${address.port}/bench/${name}`).join("\n"));
}
