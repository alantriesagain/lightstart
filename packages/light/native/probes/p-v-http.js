/**
 * @file Probe V: the asset server's shape. `http.createServer` on a loopback port chosen by the
 * system, a request answered from `fs.readFileSync` with a content type and `no-store`, a 404 for
 * a path outside the token prefix, fetched with curl spawned asynchronously (a synchronous client
 * in the same process would wait on its own server), then `server.close()`. Prints statuses and
 * bodies only, so node and native outputs match.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { collect } from "./p-v-http.read.ts";

const token = "abcdef0123456789";
const server = createServer((req, res) => {
  const url = req.url ?? "";
  if (req.method !== "GET" || !url.startsWith("/" + token + "/")) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
    return;
  }
  const rest = url.slice(token.length + 2);
  if (rest === "manifest") {
    const text = readFileSync("package.json", "utf8");
    const parsed = JSON.parse(text);
    const name = typeof parsed === "object" && parsed !== null ? /** @type {{ name?: unknown }} */ (parsed).name : "";
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ name: typeof name === "string" ? name : "" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end("<!doctype html><p>héllo " + rest + "</p>");
});

/**
 * @param {number} port
 * @param {string} path
 * @param {(text: string) => void} done
 */
const get = (port, path, done) => {
  const child = spawn("curl", ["-s", "-o", "-", "-w", "\n%{http_code} %{content_type}", "http://127.0.0.1:" + String(port) + path]);
  const stdout = child.stdout;
  if (stdout === null) {
    done("");
    return;
  }
  collect(stdout, (text) => done(text.trim()));
};

server.listen(0, "127.0.0.1", () => {
  /* @ts-expect-error */
  const port = server.address().port;
  get(port, "/" + token + "/index.html", (page) => {
    console.log("page:", page);
    get(port, "/" + token + "/manifest", (json) => {
      console.log("json:", json);
      get(port, "/other/index.html", (outside) => {
        console.log("outside:", outside);
        server.close();
        console.log("closed");
      });
    });
  });
});
