/**
 * @file Content types by file extension, the one table the static plugin and any other server of
 * files reads: the union of the tables light's test and desktop servers and bootstrapp's dev and
 * desktop servers each kept. Text types carry `charset=utf-8`; an unknown extension is an octet
 * stream. Runtime-neutral: it reads the extension off the name itself.
 */
const TYPES = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".ts", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".wasm", "application/wasm"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mp3", "audio/mpeg"],
  [".pdf", "application/pdf"],
  [".zip", "application/zip"],
]);

/** The extension of the last segment of `path`, lower-cased with its dot, "" when it has none. */
export const extensionOf = (path: string): string => {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot <= slash + 1 ? "" : path.slice(dot).toLowerCase();
};

/** The content type of a file named `path`. */
export const mimeOf = (path: string): string => TYPES.get(extensionOf(path)) ?? "application/octet-stream";
