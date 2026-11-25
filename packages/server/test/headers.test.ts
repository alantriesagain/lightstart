/**
 * @file A header list refuses what would split a reply: a CR, LF or NUL in a
 * value, and those, a space or a colon in a name, throw as the header is set
 * or appended; a route that writes a request's value into a header answers a
 * 500 rather than a second header.
 */

import { App } from "../app.ts";
import { HeaderList } from "../headers.ts";
import { text } from "../reply.ts";
import type { Reply } from "../reply.ts";
import { request } from "../memory/index.ts";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

const throws = (work: () => void): boolean => {
  try {
    work();
    return false;
  } catch {
    return true;
  }
};

const main = async (): Promise<void> => {
  const list = new HeaderList();
  list.append("X-Plain", "a value; with: punctuation, and spaces");
  eq("an ordinary value is kept", list.get("x-plain") ?? "", "a value; with: punctuation, and spaces");
  ok("a CRLF in a value throws on append", throws(() => list.append("x-echo", "a\r\nset-cookie: pwned=1")));
  ok("a lone LF throws", throws(() => list.append("x-echo", "a\nb")));
  ok("a lone CR throws", throws(() => list.append("x-echo", "a\rb")));
  ok("a NUL throws", throws(() => list.append("x-echo", "a\u0000b")));
  ok("set refuses it too", throws(() => list.set("location", "/\r\nx: y")));
  ok("a colon in a name throws", throws(() => list.append("x-a: b", "c")));
  ok("a space in a name throws", throws(() => list.append("x a", "c")));
  ok("an empty name throws", throws(() => list.append("", "c")));
  eqn("nothing refused was added", list.names.length, 1);

  const app = new App()
    .get("/echo", (c) => {
      const reply = text("x");
      reply.headers.append("x-echo", c.query("v") ?? "");
      return reply;
    })
    .onError((): Reply => text("refused", 500));
  const fine = await request(app, "GET", "/echo?v=hello");
  eq("a clean value from the request is echoed", fine.headers.get("x-echo") ?? "", "hello");
  const split = await request(app, "GET", `/echo?v=${encodeURIComponent("a\r\nset-cookie: pwned=1")}`);
  eqn("a value that would split the reply answers 500", split.status, 500);
  ok("and adds no header", split.headers.get("set-cookie") === null && split.headers.get("x-echo") === null);
  done();
};

await main();
