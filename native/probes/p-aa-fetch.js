/**
 * @file Probe AA: global fetch as an updater uses it. A local server answers text, bytes and a 404;
 * fetch reads a status, a text body, a binary body into a Buffer, sees a 404 as `ok === false`,
 * rejects on an unreachable port, and reaches an https origin with a timeout signal.
 */
import { createServer } from "node:http";

const server = createServer((req, res) => {
  if (req.url === "/ok") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("hello");
    return;
  }
  if (req.url === "/bin") {
    const bytes = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    res.end(bytes);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("nope");
});

const run = async () => {
  /* @ts-expect-error */
  const port = server.address().port;
  const origin = "http://127.0.0.1:" + String(port);
  const ok = await fetch(origin + "/ok");
  console.log("text", ok.status, ok.ok, await ok.text());
  const bin = await fetch(origin + "/bin");
  const bytes = Buffer.from(await bin.arrayBuffer());
  console.log("bytes", bin.status, bytes.length, bytes[0], bytes[255]);
  const missing = await fetch(origin + "/missing");
  console.log("missing", missing.status, missing.ok, await missing.text());
  try {
    await fetch("http://127.0.0.1:1/");
    console.log("unreachable: no throw");
  } catch (e) {
    console.log("unreachable rejects", e instanceof Error);
  }
  try {
    const secure = await fetch("https://example.com/", { signal: AbortSignal.timeout(10000) });
    console.log("https", secure.status === 200, (await secure.text()).includes("Example Domain"));
  } catch (e) {
    console.log("https failed", e instanceof Error ? e.message : "?");
  }
  server.close();
  console.log("done");
};

server.listen(0, "127.0.0.1", () => {
  run();
});
