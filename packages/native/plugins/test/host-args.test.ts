// ffi: native/ffi.json
/**
 * @file A host call whose argument cannot be converted to text: an out-of-memory conversion is the
 * plugin's error, not a call with an empty argument. The engine has a small memory limit, and the
 * plugin builds a wide string too large to convert. The node stand-in has no memory limit, so it
 * converts the string and calls the host; the line printed is true under both.
 */
import { done, ok } from "@light/test/assert.ts";
import { HostAnswer, HostHandler, JsEngine, OK } from "../engine.ts";

class Watch extends HostHandler {
  sawEmpty = false;

  override answer(_name: string, args: string): HostAnswer {
    if (args === "") this.sawEmpty = true;
    return new HostAnswer(OK, "null");
  }
}

const host = new Watch();
const engine = new JsEngine(host, 10, 2000);
engine.eval('const s = "€".repeat(3000000); try { __host("big", s); } catch (e) {} "done"', "big.js");
ok("the host never saw an empty argument", !host.sawEmpty);
engine.free();
done();
