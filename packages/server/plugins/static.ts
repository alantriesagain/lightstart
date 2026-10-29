/**
 * @file Files from a folder, on node and natively: `app.plugin(new Static({ root: "public" }))`.
 * It serves GET and HEAD under its prefix ("" for the whole site) through a wildcard route, so
 * every more specific route wins over it. A request's path is decoded and refused when it names a
 * parent folder, a NUL byte or (unless allowed) a dotfile, and the file it resolves to must lie
 * inside the root. It is looked for as the exact file, then the folder's `index.html`, then the
 * path with `.html` added, then, for a path with no extension, the `spa` file when one is named;
 * anything else is a 404. A file answers with its type, a weak ETag and
 * `last-modified` (a matching `if-none-match` or `if-modified-since` is a 304), the configured
 * `cache-control`, and (unless turned off) its `.br` or `.gz` neighbour when the client accepts it. A small file is read
 * whole; a large one is streamed, paused while the client's side of the socket is full.
 */
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { App } from "../app.ts";
import { Context } from "../context.ts";
import { Plugin } from "../plugin.ts";
import { Reply, Writer, bytes, empty, fail, stream } from "../reply.ts";
import { extensionOf, mimeOf } from "./mime.ts";

export interface StaticOptions {
  /** The folder the files are in. */
  root: string;
  /** The URL prefix they are served under ("/assets"), the whole site by default. */
  prefix?: string;
  /** The file answering a folder, "index.html" by default. */
  index?: string;
  /** The file answering a path with no extension that nothing else answered, for a single-page app. */
  spa?: string;
  /** Serve files and folders whose name starts with a dot. */
  dotfiles?: boolean;
  /** The `cache-control` of every file, "no-cache" (revalidate every time) by default. */
  cacheControl?: string;
  /** Files larger than this many bytes are streamed instead of read whole; 256 KiB by default. */
  streamAbove?: number;
  /** The content type of a file, `mimeOf` by default: a host with a fuller table (the `mime` package) hands its own. */
  typeOf?: (path: string) => string;
  /** Answer with a file's `.br` or `.gz` neighbour when the client accepts it; true by default. A host that serves a build as it is turns it off. */
  precompressed?: boolean;
}

class Found {
  readonly path: string;
  readonly size: number;
  readonly mtime: number;

  constructor(path: string, size: number, mtime: number) {
    this.path = path;
    this.size = size;
    this.mtime = mtime;
  }
}

const fileAt = async (path: string): Promise<Found | null> => {
  try {
    const s = await stat(path);
    return s.isFile() ? new Found(path, s.size, s.mtimeMs) : null;
  } catch {
    return null;
  }
};

const folderAt = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
};

const decoded = (rest: string): string | null => {
  try {
    return decodeURIComponent(rest);
  } catch {
    return null;
  }
};

const fileBody = (path: string) => (out: Writer): Promise<void> =>
  new Promise<void>((done: () => void, failed: (reason: Error) => void) => {
    const source = createReadStream(path);
    source.on("data", (chunk: Buffer) => {
      source.pause();
      out.write(chunk).then(() => {
        if (out.closed) source.destroy();
        else source.resume();
      });
    });
    source.on("end", () => done());
    source.on("close", () => done());
    source.on("error", (error: Error) => failed(error));
  });

export class Static extends Plugin {
  readonly options: StaticOptions;
  private readonly root: string;

  constructor(options: StaticOptions) {
    super("static", []);
    this.options = options;
    this.root = resolve(options.root);
  }

  /** The file a request path (below the prefix) names, null when none does or the path is refused. */
  async find(rest: string): Promise<Found | null> {
    const rel = decoded(rest);
    if (rel === null || rel.indexOf("\0") >= 0 || rel.indexOf("\\") >= 0) return null;
    const segments = rel.split("/");
    for (const s of segments) {
      if (s === "..") return null;
      if (s.startsWith(".") && s !== "" && this.options.dotfiles !== true) return null;
    }
    const abs = join(this.root, rel);
    if (abs !== this.root && !abs.startsWith(this.root + sep)) return null;
    const index = this.options.index ?? "index.html";
    if (!rel.endsWith("/") && rel !== "") {
      const exact = await fileAt(abs);
      if (exact !== null) return exact;
    }
    if (await folderAt(abs)) {
      const inFolder = await fileAt(join(abs, index));
      if (inFolder !== null) return inFolder;
    }
    if (extensionOf(rel) === "" && rel !== "" && !rel.endsWith("/")) {
      const html = await fileAt(abs + ".html");
      if (html !== null) return html;
    }
    const spa = this.options.spa;
    if (spa !== undefined && extensionOf(rel) === "") return fileAt(join(this.root, spa));
    return null;
  }

  /** The reply for the found file: a 304 when the client's copy is current, else the file or its compressed neighbour. */
  async reply(c: Context, found: Found): Promise<Reply> {
    const etag = "W/\"" + found.size.toString(16) + "-" + Math.floor(found.mtime).toString(16) + "\"";
    const modified = new Date(Math.floor(found.mtime / 1000) * 1000);
    const cache = this.options.cacheControl ?? "no-cache";
    const fresh = (reply: Reply): Reply => {
      reply.headers.set("etag", etag);
      reply.headers.set("last-modified", modified.toUTCString());
      reply.headers.set("cache-control", cache);
      return reply;
    };
    const match = c.header("if-none-match");
    if (match !== null) {
      if (match === "*" || match.split(",").some((tag: string) => tag.trim() === etag)) return fresh(empty(304));
    } else {
      const since = c.header("if-modified-since");
      if (since !== null) {
        const at = Date.parse(since);
        if (!Number.isNaN(at) && modified.getTime() <= at) return fresh(empty(304));
      }
    }
    const typeOf = this.options.typeOf;
    const type = typeOf === undefined ? mimeOf(found.path) : typeOf(found.path);
    const accepts = this.options.precompressed === false ? "" : (c.header("accept-encoding") ?? "");
    let file = found;
    let encoding = "";
    if (accepts.indexOf("br") >= 0) {
      const br = await fileAt(found.path + ".br");
      if (br !== null) {
        file = br;
        encoding = "br";
      }
    }
    if (encoding === "" && accepts.indexOf("gzip") >= 0) {
      const gz = await fileAt(found.path + ".gz");
      if (gz !== null) {
        file = gz;
        encoding = "gzip";
      }
    }
    const reply = file.size > (this.options.streamAbove ?? 262144) ? stream(fileBody(file.path), type) : bytes(await readFile(file.path), type);
    if (encoding !== "") {
      reply.headers.set("content-encoding", encoding);
      reply.headers.append("vary", "Accept-Encoding");
    }
    if (reply.stream !== null) reply.headers.set("content-length", String(file.size));
    return fresh(reply);
  }

  setup(app: App): void {
    const prefix = this.options.prefix ?? "";
    if (prefix !== "" && (!prefix.startsWith("/") || prefix.endsWith("/"))) throw new Error("a static prefix starts with / and does not end with one: \"" + prefix + "\"");
    app.get(prefix + "/*", async (c: Context): Promise<Reply> => {
      const found = await this.find(c.param("*") ?? "");
      if (found === null) return fail("no file at " + c.path, 404);
      return this.reply(c, found);
    });
  }
}
