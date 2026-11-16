// ffi: native/ffi.json
/**
 * @file A plugin as ES modules: its files registered, its entry evaluated, a relative import
 * resolved against the importing file's folder (`./`, `../`), a file not registered and a bare
 * specifier refused, an error in a module the entry's error, and an entry evaluated again under a
 * new generation compiling its imports again from the files registered now.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { FAILED, HostAnswer, HostHandler, JsEngine, OK } from "../engine.ts";

class Quiet extends HostHandler {
  override answer(_name: string, _args: string): HostAnswer {
    return new HostAnswer(OK, "null");
  }
}

const engine = new JsEngine(new Quiet(), 16, 1000);
engine.addModule("/p/lib/a.js", 'import { b } from "../b.js"; export const a = () => "a" + String(b);');
engine.addModule("/p/b.js", "export const b = 1;");
const entry = 'import { a } from "./lib/a.js"; globalThis.seen = a();';
const first = engine.evalModule(entry, "/p/index.js#1");
eq("the entry runs, its imports resolved and loaded", String(first.status) + " " + engine.eval("globalThis.seen", "read.js").text, "0 a1");

const missing = engine.evalModule('import { x } from "./nope.js";', "/p/other.js#1");
ok("a file that is not the plugin's is refused", missing.status === FAILED && missing.message().includes("cannot import /p/nope.js"));
const bare = engine.evalModule('import fs from "fs";', "/p/bare.js#1");
ok("a bare specifier is refused", bare.status === FAILED && bare.message().includes("cannot import fs"));
engine.addModule("/p/bad.js", "throw new Error('broken module');");
const broken = engine.evalModule('import "./bad.js";', "/p/broken.js#1");
ok("an error in an imported module is the entry's", broken.status === FAILED && broken.message().includes("broken module"));

engine.addModule("/p/b.js", "export const b = 2;");
engine.evalModule(entry, "/p/index.js#1");
eq("the same generation keeps the modules it compiled", engine.eval("globalThis.seen", "read.js").text, "a1");
engine.evalModule(entry, "/p/index.js#2");
eq("a new generation compiles its imports again", engine.eval("globalThis.seen", "read.js").text, "a2");

const later = engine.evalModule("await Promise.resolve(); globalThis.late = 'settled';", "/p/late.js#1");
eq("a top-level await settles before the result", String(later.status) + " " + engine.eval("globalThis.late", "read.js").text, "0 settled");
engine.free();
done();
