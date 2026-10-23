/**
 * @bootstrapp/light/native/desktop/server: the page's files over loopback. The webview has no
 * custom URL scheme, so the backend serves `web/` over HTTP on 127.0.0.1 at a port the system
 * picks, under a path prefix only this launch knows, with light's own files under `light/` and
 * an import map injected into index.html. Nothing is cached, nothing is listed, and a request
 * from any other host name or outside the prefix is refused.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

/** @type {Map<string, string>} */
const TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

/** The handle `createAssetServer` answers: the port and token the URL needs, and a way to stop. */
export class AssetServer {
  /**
   * @param {string} token
   * @param {import("node:http").Server} server
   */
  constructor(token, server) {
    this.token = token;
    this.server = server;
    this.port = 0;
  }

  /** @param {string} path a path inside the served tree, such as "index.html" */
  url(path) {
    return "http://127.0.0.1:" + String(this.port) + "/" + this.token + "/" + path;
  }

  close() {
    this.server.close();
  }
}

/**
 * The import map the page gets: `importmap.json` beside index.html maps bare specifiers to
 * paths under the served tree; the token prefix is added here.
 * @param {string} webDir
 * @param {string} prefix
 */
const importMapTag = (webDir, prefix) => {
  const file = join(webDir, "importmap.json");
  if (!existsSync(file)) return "";
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(file, "utf8")));
  if (typeof parsed !== "object" || parsed === null) return "";
  const imports = /** @type {{ imports?: unknown }} */ (parsed).imports;
  if (typeof imports !== "object" || imports === null) return "";
  /** @type {Record<string, string>} */
  const mapped = {};
  for (const [name, target] of Object.entries(/** @type {Record<string, unknown>} */ (imports)))
    if (typeof target === "string") mapped[name] = prefix + target;
  return "<script type=\"importmap\">" + JSON.stringify({ imports: mapped }) + "</script>";
};

/**
 * Serve `webDir` (the page) and `lightDir` (light's files, under `light/`) to the local webview.
 * `listening` runs with the server once it has its port.
 * @param {string} webDir
 * @param {string} lightDir
 * @param {(server: AssetServer) => void} listening
 */
export const createAssetServer = (webDir, lightDir, listening) => {
  const token = randomBytes(16).toString("hex");
  const prefix = "/" + token + "/";
  const server = createServer((req, res) => {
    const url = req.url ?? "";
    const host = req.headers.host ?? "";
    if ((req.method !== "GET" && req.method !== "HEAD") || !url.startsWith(prefix) || !host.startsWith("127.0.0.1:")) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    const query = url.indexOf("?");
    const rest = (query >= 0 ? url.slice(0, query) : url).slice(prefix.length);
    const inLight = rest.startsWith("light/");
    const root = inLight ? lightDir : webDir;
    const relative = normalize(decodeURIComponent(inLight ? rest.slice(6) : rest === "" ? "index.html" : rest));
    if (relative.startsWith("..") || relative.startsWith("/")) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    const file = join(root, relative);
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    const type = TYPES.get(extname(file)) ?? "application/octet-stream";
    if (!inLight && relative === "index.html") {
      let html = readFileSync(file, "utf8");
      const tag = importMapTag(webDir, prefix);
      if (tag.length > 0) html = html.includes("<!--importmap-->") ? html.replace("<!--importmap-->", tag) : html.replace("</head>", tag + "</head>");
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(html);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(readFileSync(file));
  });
  const handle = new AssetServer(token, server);
  server.listen(0, "127.0.0.1", () => {
    handle.port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
    listening(handle);
  });
  return handle;
};
