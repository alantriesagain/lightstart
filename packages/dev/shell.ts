/**
 * @file The app shell a route request gets: the project's `index.html` with the dev importmap
 * written in, and the reload client when the server is watching.
 */
import type { ImportMap } from "./importmap.ts";

const IMPORTMAP_SCRIPT = /<script\b[^>]*\btype\s*=\s*["']importmap["'][^>]*>[\s\S]*?<\/script>\s*/gi;

const intoHead = (html: string, tag: string): string => {
  if (html.includes("</head>")) return html.replace("</head>", "\t" + tag + "\n</head>");
  if (html.includes("<head>")) return html.replace("<head>", "<head>\n\t" + tag);
  return tag + "\n" + html;
};

const intoBody = (html: string, tag: string): string => {
  if (html.includes("</body>")) return html.replace("</body>", "\t" + tag + "\n</body>");
  return html + "\n" + tag;
};

/** The shell HTML with `importmap` as its only importmap, and the reload client when asked. */
export const renderShell = (html: string, importmap: ImportMap, options: { reload?: boolean } = {}): string => {
  let out = html.replace(IMPORTMAP_SCRIPT, "");
  if (Object.keys(importmap).length > 0) {
    out = intoHead(out, '<script type="importmap">' + JSON.stringify({ imports: importmap }) + "</script>");
  }
  if (options.reload === true) out = intoBody(out, '<script type="module" src="/__light/reload.js"></script>');
  return out;
};

/** The client served at `/__light/reload.js`: reloads the page on a change and reconnects when the socket drops. */
export const RELOAD_CLIENT = `(() => {
  const connect = () => {
    const socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host);
    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === "file-changed") location.reload();
      } catch {}
    });
    socket.addEventListener("close", () => setTimeout(connect, 1000));
  };
  connect();
})();
`;
