/**
 * @file Probe T: the desktop shell's FFI shapes against a stub with no GUI. A pointer handle held
 * as a bigint, (ptr, len) strings including the empty one, a retained callback with a context
 * pointer fired from inside a later pump call driven by a timer chain, replies answered through a
 * Promise after the pump returns, routes in a Map of functions, a `$log` built-in, the paired
 * release, and a cross-module `declare` import. Prints "ok" lines and "done".
 */
import { stub_bind, stub_bound, stub_create, stub_destroy, stub_fired, stub_pump, stub_replies, stub_reply_is, stub_reply_status, stub_return, stub_set_title, stub_title_len, stub_unbind } from "./p-t-ffi.decl.ts";

let failures = 0;
/**
 * @param {string} name
 * @param {boolean} cond
 */
const ok = (name, cond) => {
  if (!cond) failures++;
  console.log((cond ? "ok " : "FAIL ") + name);
};

/** @type {Map<string, (args: unknown[]) => Promise<unknown>>} */
const routes = new Map();
routes.set("echo", (args) => Promise.resolve(args));
/** @type {string[]} */
const logs = [];

const w = stub_create(0);
ok("create answers a handle", w !== 0n);
stub_set_title(w, "héllo");
ok("string arrives as utf-8 bytes", stub_title_len(w) === 6);
stub_set_title(w, "");
ok("empty string is a zero-length span", stub_title_len(w) === 0 || stub_title_len(w) === -1);

/**
 * @param {string} id
 * @param {string} req
 */
const onCall = (id, req) => {
  const parsed = JSON.parse(req);
  if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" || !Array.isArray(parsed[1])) {
    stub_return(w, id, 0, JSON.stringify({ ok: false, error: "bad request" }));
    return;
  }
  const method = parsed[0];
  const args = parsed[1];
  if (method === "$log") {
    logs.push(typeof args[1] === "string" ? args[1] : "?");
    stub_return(w, id, 0, "");
    return;
  }
  const route = routes.get(method);
  if (route === undefined) {
    stub_return(w, id, 0, JSON.stringify({ ok: false, error: "no method " + method }));
    return;
  }
  route(args).then((value) => {
    stub_return(w, id, 0, JSON.stringify({ ok: true, value }));
  });
};

ok("bind registers", stub_bind(w, "__desktop", onCall) === 9);
let running = true;
const finish = () => {
  ok("callback fired from the pump", stub_fired(w) === 3);
  ok("three replies recorded", stub_replies(w) === 3);
  ok("echo reply has the id and the value", stub_reply_is(w, 0, "7", "{\"ok\":true,\"value\":[1,\"a\"]}"));
  ok("missing method is an error reply", stub_reply_is(w, 1, "8", "{\"ok\":false,\"error\":\"no method missing\"}"));
  ok("$log reply is undefined and the text decoded", stub_reply_is(w, 2, "9", "") && logs.join("|") === "hé");
  ok("reply status is zero", stub_reply_status(w, 0) === 0);
  stub_unbind(w, "__desktop", onCall);
  ok("release unbinds", stub_bound(w) === 0);
  stub_pump(w);
  ok("a pump after the release fires nothing", stub_fired(w) === 3);
  stub_destroy(w);
  console.log("done " + String(failures === 0 ? "ok" : "failed"));
  if (failures > 0) process.exit(1);
};
const tick = () => {
  if (!running) return;
  if (stub_pump(w) === 0) {
    running = false;
    finish();
    return;
  }
  setTimeout(tick, 2);
};
setTimeout(tick, 2);
