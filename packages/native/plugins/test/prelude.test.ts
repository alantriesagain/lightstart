// ffi: native/ffi.json
/**
 * @file The prelude built for an app: its global holds plugin(), util and the theme; a plugin registers
 * through `call("plugin", …)` with its activate function's id; invoked, it calls the app's namespace,
 * which goes to the core as `__host` with its arguments as JSON; the core's answer comes back parsed.
 */
import { done, eq, eqn, ok } from "@light/test/assert.ts";
import { FAILED, HostAnswer, HostHandler, JsEngine, OK } from "../engine.ts";
import { buildPrelude } from "../prelude.ts";

class Core extends HostHandler {
  activate = -1;
  seen: string[] = [];

  override answer(name: string, args: string): HostAnswer {
    this.seen.push(name + " " + args);
    if (name === "plugin") {
      this.activate = (JSON.parse(args) as unknown[])[3] as number;
      return new HostAnswer(OK, "null");
    }
    if (name === "greet") return new HostAnswer(OK, JSON.stringify("hi " + String((JSON.parse(args) as unknown[])[0])));
    return new HostAnswer(FAILED, "no " + name);
  }
}

const core = new Core();
const engine = new JsEngine(core, 16, 1000);
const prelude = buildPrelude("app", '{"dim":"gray","marks":{"M":"yellow"},"frames":["-","\\\\","|","/"],"tick":250}', "      greet: (who) => call(\"greet\", String(who)),\n");
const built = engine.eval(prelude, "app:prelude");
eq("the prelude evaluates", String(built.status), "0");
eq("the global holds the version, util and the theme", engine.eval("typeof app.plugin + \" \" + app.version + \" \" + typeof app.util.width + \" \" + app.theme.dim + \" \" + app.theme.spinner(250)", "global.js").text, "function 1 function gray \\");
eq("util measures text as the screen does", engine.eval("String(app.util.width(\"ab\u4e2d\"))", "width.js").text, "4");
eq("util.wrap keeps words", engine.eval('app.util.wrap("just now", 20).join("|")', "wrap.js").text, "just now");
eq("util.throttle runs once in its window", engine.eval('const f = app.util.throttle(() => { globalThis.n = (globalThis.n ?? 0) + 1; }, 1000); f(); f(); f(); String(globalThis.n)', "throttle.js").text, "1");
eq("util.str and util.num", engine.eval('app.util.str(1) + "|" + app.util.str("x") + "|" + app.util.num("x", 2)', "narrow.js").text, "|x|2");
eq("util.list, util.obj and util.parse", engine.eval('String(app.util.list(1).length) + "|" + String(app.util.obj([])) + "|" + String(app.util.parse("{nope"))', "json.js").text, "0|null|null");
eq("util.quote", engine.eval('app.util.quote("a" + String.fromCharCode(39) + "b")', "quote.js").text, "'a'\\''b'");
engine.eval("__file(\"one.js\"); app.plugin({ id: \"one\", requires: [\"two\"], activate(api) { globalThis.got = api.greet(\"x\"); } });", "one.js");
ok("the registration reached the core with the id, the requirements and the file", core.seen.some((s) => s.startsWith("plugin [\"one\",[\"two\"],true,")) && core.seen[0].includes("\"one.js\""));
eqn("the activate function got an id", core.activate >= 0 ? 1 : 0, 1);
const ran = engine.invoke(core.activate, "[]");
eq("invoked, it called the app's namespace, answered by the core", String(ran.status) + " " + engine.eval("got", "got.js").text, "0 hi x");
ok("the call crossed as JSON, with its registration", core.seen[core.seen.length - 1].startsWith('greet ["x",') && core.seen[core.seen.length - 1].includes('"@r'));
const bad = engine.eval("app.plugin({})", "bad.js");
ok("a plugin without an id is refused in the app's name", bad.status === FAILED && bad.message().includes("app.plugin: a plugin needs an id"));
engine.eval("__retire(1)", "retire.js");
eqn("retired, its functions are gone", engine.invoke(core.activate, "[]").status, FAILED);
done();
