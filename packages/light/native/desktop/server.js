/**
 * @lightstart/light/native/desktop/server: the page's files over loopback. The webview has no
 * custom URL scheme, so the backend serves `web/` over HTTP on 127.0.0.1 at a port the system
 * picks, under a path prefix only this launch knows, with light's own files under `light/` and
 * an import map injected into index.html. Nothing is cached, nothing is listed, and a request
 * from any other host name, with another method or outside the prefix is refused. It runs on
 * `@lightstart/server` (an optional peer a desktop app installs): two static folders and the
 * page's own route, behind one hook that refuses what is not the webview's.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { App, html, text } from "@lightstart/server";
import { serve } from "@lightstart/server/node";
import { Static } from "@lightstart/server/static";

/** @import { Reply } from "@lightstart/server" */
/** @import { NodeServer } from "@lightstart/server/node" */

/** The handle `createAssetServer` answers: the port and token the URL needs, and a way to stop. */
export class AssetServer {
  /** @param {string} token */
  constructor(token) {
    this.token = token;
    this.port = 0;
    /** @type {NodeServer | null} */
    this.node = null;
    this.closed = false;
  }

  /** @param {string} path a path inside the served tree, such as "index.html" */
  url(path) {
    return "http://127.0.0.1:" + String(this.port) + "/" + this.token + "/" + path;
  }

  close() {
    this.closed = true;
    if (this.node !== null) this.node.close();
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
  /** @type {() => Reply} */
  const page = () => {
    const file = join(webDir, "index.html");
    if (!existsSync(file)) return text("not found", 404);
    let body = readFileSync(file, "utf8");
    const tag = importMapTag(webDir, prefix);
    if (tag.length > 0) body = body.includes("<!--importmap-->") ? body.replace("<!--importmap-->", tag) : body.replace("</head>", tag + "</head>");
    return html(body).header("cache-control", "no-store");
  };
  const app = new App()
    .onRequest((c) => {
      const host = c.header("host") ?? "";
      if ((c.method !== "GET" && c.method !== "HEAD") || !c.path.startsWith(prefix) || !host.startsWith("127.0.0.1:")) return text("not found", 404);
      return null;
    })
    .get(prefix, page)
    .get(prefix + "index.html", page)
    .plugin(new Static({ root: lightDir, prefix: prefix + "light", cacheControl: "no-store" }))
    .plugin(new Static({ root: webDir, prefix: "/" + token, cacheControl: "no-store" }));
  const handle = new AssetServer(token);
  serve(app, { port: 0, host: "127.0.0.1" }).then((node) => {
    handle.node = node;
    handle.port = node.port;
    if (handle.closed) node.close();
    else listening(handle);
  });
  return handle;
};
