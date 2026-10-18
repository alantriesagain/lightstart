import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bailouts, compilations, tiersOf } from "./v8-trace.js";

const TRACE = `[marking <JSFunction increment> for optimization to MAGLEV, ConcurrencyMode::kConcurrent, reason: hot and stable]
[completed compiling <JSFunction increment> (target MAGLEV) - took 0.001, 0.111, 0.002 ms]
[completed compiling <JSFunction> (target MAGLEV) OSR - took 0.001, 0.166, 0.002 ms]
[bailout (kind: deopt-eager, reason: Insufficient type feedback for generic global access): begin. deoptimizing <JSFunction>, <Code MAGLEV>, opt id 2, bytecode offset 116]
[completed compiling <JSFunction> (target TURBOFAN_JS) OSR - took 0.010, 0.966, 0.013 ms]
[bailout (kind: deopt-eager, reason: wrong map): begin. deoptimizing <JSFunction total>, <Code TURBOFAN_JS>, opt id 5]`;

describe("node's optimization trace, read back", () => {
  it("lists what each compiler finished, the module's top level by that name", () => {
    assert.deepEqual(compilations(TRACE), [
      { fn: "increment", tier: "Maglev", osr: false },
      { fn: "top level", tier: "Maglev", osr: true },
      { fn: "top level", tier: "TurboFan", osr: true },
    ]);
    assert.equal(tiersOf(compilations(TRACE), "top level"), "Maglev, then TurboFan");
  });

  it("reads each bailout's function, reason and the code it left", () => {
    assert.deepEqual(bailouts(TRACE), [
      { fn: "top level", reason: "insufficient type feedback for generic global access", from: "Maglev" },
      { fn: "total", reason: "wrong map", from: "TurboFan" },
    ]);
  });
});

describe("a captured run, in sentences", () => {
  it("names each function's compilers and each deoptimization", async () => {
    const { describeRun } = await import("./v8-trace.js");
    assert.equal(
      describeRun(TRACE),
      "In this run, V8 compiled `increment` with Maglev and the module's top level (the function that contains the loop) with Maglev, then TurboFan, switching while it ran. It deoptimized 2 times, discarding the top level's Maglev code (insufficient type feedback for generic global access) and `total`'s TurboFan code (wrong map), and each time continued in bytecode.",
    );
  });
});
