// ffi: native/ffi.json
/**
 * @file The engine over one QuickJS context: a script's value comes back as text, a plugin function the
 * prelude numbered is called with its arguments as JSON, a call into the core gets the handler's
 * answer or throws its refusal in the plugin, an error carries its message first, the promise jobs
 * a call left run before the next, and a freed engine answers nothing.
 */
import { done, eq, eqn, ok } from "@light/test/assert.ts";
import { FAILED, HostAnswer, HostHandler, JsEngine, OK, OVER_BUDGET } from "../engine.ts";

class Echo extends HostHandler {
  calls: string[] = [];

  override answer(name: string, args: string): HostAnswer {
    this.calls.push(name + " " + args);
    if (name === "refuse") return new HostAnswer(FAILED, "no " + name);
    return new HostAnswer(OK, JSON.stringify({ name, count: (JSON.parse(args) as unknown[]).length }));
  }
}

class Quiet extends HostHandler {
  override answer(_name: string, _args: string): HostAnswer {
    return new HostAnswer(OK, "null");
  }
}

const host = new Echo();
const engine = new JsEngine(host, 16, 1000);
const sum = engine.eval("1 + 2", "sum.js");
eq("a script's value, as text", String(sum.status) + " " + sum.text, "0 3");
eq("a string stays as it is", engine.eval('"plain"', "text.js").text, "plain");
eq("the invoke table installed", engine.eval("globalThis.__invoke = (id, json) => JSON.stringify([id, JSON.parse(json).length]); 'ok'", "prelude.js").text, "ok");
const called = engine.invoke(7, "[1,2,3]");
eq("a plugin function called by id, its arguments as JSON", String(called.status) + " " + called.text, "0 [7,3]");
eq("a call into the core gets the handler's answer", engine.eval('__host("ping", "[1,2]")', "host.js").text, '{"name":"ping","count":2}');
eq("the handler saw the call", host.calls.join("|"), "ping [1,2]");
const refused = engine.eval('__host("refuse", "[]")', "refuse.js");
ok("a refused call fails in the plugin with the refusal", refused.status === FAILED && refused.message().includes("no refuse"));
const thrown = engine.eval("throw new Error('boom')", "throw.js");
ok("an error: its message first, its stack after", thrown.status === FAILED && thrown.message().includes("boom") && thrown.text.includes("\n"));
const circular = engine.eval("const a = {}; a.self = a; a", "circular.js");
ok("a value JSON cannot write is an error, not null", circular.status === FAILED && circular.text.length > 0);
engine.eval("globalThis.after = 0; Promise.resolve().then(() => { globalThis.after = 1; });", "jobs.js");
eqn("the jobs a call left ran before the next, none left", engine.jobs().length, 0);
eq("and their effect shows", engine.eval("String(globalThis.after)", "after.js").text, "1");
engine.free();
eqn("a freed engine answers nothing", engine.eval("1", "freed.js").status, FAILED);

const looping = new JsEngine(new Quiet(), 16, 100);
looping.eval("globalThis.__invoke = () => { (async () => { while (true) await 0; })(); return 'ok'; }", "jobs-loop.js");
const loopRun = looping.invoke(1, "[]");
const loopJobs = looping.jobs();
ok("an async loop is stopped by one budget for the pump", loopRun.status === OVER_BUDGET || loopJobs.some((e) => e.status === OVER_BUDGET));
looping.free();

const calling = new JsEngine(new Quiet(), 16, 100);
calling.eval('globalThis.__invoke = () => { while (true) __host("ping", "[]"); }', "host-loop.js");
const hostRun = calling.invoke(1, "[]");
ok("a loop of host calls is stopped by the budget", hostRun.status === OVER_BUDGET);
calling.free();
done();
