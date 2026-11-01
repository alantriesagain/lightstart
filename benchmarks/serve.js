import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { App, html } from "@lightstart/server";
import { serve as listen } from "@lightstart/server/node";
import { Static } from "@lightstart/server/static";
import { stage } from "@lightstart/light/scripts/pack.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "packages", "light");
const PAGES = path.join(HERE, "pages");

/**
 * Stage the package and map its exports, and nothing else, so a page loads
 * exactly what the package ships.
 * @returns {{ imports: Record<string, string> }}
 */
export const importMap = () => {
  const { manifest } = stage();
  /** @type {Record<string, string>} */
  const imports = {};
  for (const [key, target] of Object.entries(manifest.exports)) {
    if (key.includes("*")) continue;
    const entry = typeof target === "string" ? target : target.default;
    imports[key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`] = `/dist/${entry.slice(2)}`;
  }
  return { imports };
};

/**
 * Serve the package folder, and the benchmark pages under `/bench/`, with the
 * importmap injected where a page carries `<!--importmap-->`. Answers the node
 * server, which `ab.js` reads the port of and closes, as it does the one an
 * older tree's copy of this file answers.
 * @param {number} [port]
 * @returns {Promise<import("node:http").Server>}
 */
export const serve = async (port = 0) => {
  const map = `<script type="importmap">${JSON.stringify(importMap())}</script>`;
  const pages = new Static({ root: PAGES, prefix: "/bench", cacheControl: "no-store" });
  const files = new Static({ root: ROOT, cacheControl: "no-store" });
  /**
   * @param {Static} folder
   * @param {import("@lightstart/server").Context} c
   */
  const answer = async (folder, c) => {
    const found = await folder.find(c.param("*") ?? "");
    if (found === null) return html("", 404);
    if (found.path.endsWith(".html")) return html(fs.readFileSync(found.path, "utf8").replace("<!--importmap-->", map)).header("cache-control", "no-store");
    return folder.reply(c, found);
  };
  const app = new App().get("/bench/*", (c) => answer(pages, c)).get("/*", (c) => answer(files, c));
  return (await listen(app, { port, host: "127.0.0.1" })).server;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serve(Number(process.argv[2] ?? 4600));
  const address = /** @type {import("node:net").AddressInfo} */ (server.address());
  const pages = fs.readdirSync(PAGES).filter((name) => name.endsWith(".html"));
  console.log(pages.map((name) => `http://127.0.0.1:${address.port}/bench/${name}`).join("\n"));
}
