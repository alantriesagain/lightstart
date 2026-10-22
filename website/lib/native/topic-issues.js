/**
 * /native/issues: open issues in light's native build and in scriptc: performance
 * against Node, the fork's status against scriptc 0.3.7, JSDoc-typed
 * JavaScript, intentional differences from Node, tsc-ts's status, and how
 * these pages are generated.
 */
import captures from "./captures.js";
import measures from "./measures.js";

const { tools } = captures;
const { bench } = measures;

/** @param {number} ms */
const ms = (ms) => `${ms.toFixed(1)}\u00a0ms`;

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "Open issues",
  lede: "Known gaps in light's native build and in scriptc, and what each one depends on.",
  sections: [
    {
      id: "performance",
      title: "Performance",
      blocks: [
        { kind: "text", text: "On light's benchmark, the native executable is slower than Node on most steps:" },
        {
          kind: "table",
          columns: [
            { name: "step", label: "Step" },
            { name: "node", label: "Node" },
            { name: "native", label: "Native" },
            { name: "ratio", label: "Native ÷ Node" },
          ],
          rows: bench.steps.map((step) => ({ step: step.step, node: ms(step.node), native: ms(step.native), ratio: `${(step.native / step.node).toFixed(2)}×` })),
        },
        {
          kind: "text",
          text: "Light's notes attribute the remaining time to three things: boxing class instances so they can pass through `unknown`-typed values and releasing them again, the cycle collector, and objects that scriptc keeps in its dynamic representation, where every field write is a lookup by name. A terminal screen has hundreds of nodes rather than ten thousand, so a frame still renders in milliseconds. `native/tui/microbench.js` times each of these operations separately, to measure each scriptc release.",
        },
      ],
    },
    {
      id: "fork",
      title: "Fork status",
      blocks: [
        {
          kind: "text",
          text: "Upstream has implemented its own versions of three of the fork's fixes (#1208, #1215, #1218), crediting light's author, but no release includes them yet. On 2026-10-18, the fork's tests were run against an unpatched build of upstream's main branch. The results:",
        },
        {
          kind: "list",
          items: [
            "`census-typed-keys` and `ts-unknown-fields` can be dropped at 0.3.7: upstream handles every case light uses.",
            "`generic-method-slots` can be dropped if light's checks pass without it. Upstream still fails a method read through a receiver typed as a non-generic base class; light's signals have that structure but do not call methods through the base type.",
            "`generic-unknown-fields` has to be ported to upstream's implementation of `unknown` fields; it does not apply as it is.",
            "`census-report`, `generic-record-return`, `async-return-union` and `async-dynamic-return` are still needed: their tests fail without them.",
          ],
        },
        {
          kind: "text",
          text: "The fork's tests also found three cases upstream's versions do not handle, to report upstream: fields typed `(object | null)[]`, method reads through a non-generic base type, and literal keys under `as string`. `census-report` uses the diagnostic code SC7001, which scriptc's contracts checker already uses, so it needs a different code before it can be merged.",
        },
      ],
    },
    {
      id: "javascript",
      title: "JSDoc-typed JavaScript",
      blocks: [
        { kind: "text", text: "Light's examples and parts of its library are still JavaScript with JSDoc types, which scriptc compiles less efficiently than TypeScript. Open issues found in light, most with a workaround in light's code:" },
        {
          kind: "list",
          items: [
            "A JSDoc-typed function returns a copy of a record argument, so identity and writes through the result are lost.",
            "Reading a member of a call result typed with a self-referencing union and an intersected index signature causes an internal compiler error.",
            "Calls through an object literal behind a JSDoc cast are not compiled; the same object declared with `@type` is.",
            "A `function` declaration that reads a module-level `Map` of an interface type defers its reads; arrow functions compile.",
            "Values from `Object.entries` captured by a closure are deferred.",
          ],
        },
      ],
    },
    {
      id: "unreported-differences",
      title: "Differences coverage does not report",
      blocks: [
        {
          kind: "text",
          text: "A property added through a cast to `Record<string, unknown>` is written to a copy of the object, so the original never has it, and the program prints something different from Node ([the example](/native/types#properties-added-through-a-cast)). scriptc's documentation says such conversions can copy, but coverage reports the program as fully static, with no note.",
        },
      ],
    },
    {
      id: "differences",
      title: "Intentional differences from Node",
      blocks: [
        {
          kind: "list",
          items: [
            "A cast from a value whose type is only known at run time is checked and throws when the value does not match ([example](/native/scriptc#dynamic-values)). Node does not check casts.",
            "Code that only exists at run time, such as `eval`, is rejected at build time ([example](/native/scriptc#unsupported-code)).",
            "scriptc's [limitations page](https://scriptc.dev/docs/limitations) has the complete list.",
          ],
        },
      ],
    },
    {
      id: "tsc-ts",
      title: "tsc-ts status",
      blocks: [
        {
          kind: "text",
          text: `tsc-ts is at version ${tools.tscTs}. Its API server supports the checker queries scriptc makes and language service methods such as completions and references, but not the profiling methods. Like \`tsc --api\`, it reports completions that need auto imports as unavailable ([its README](https://github.com/vercel-labs/tsc-ts#api-server)).`,
        },
      ],
    },
    {
      id: "generation",
      title: "How these pages are generated",
      blocks: [
        {
          kind: "text",
          text: `Every snippet and number on these pages comes from \`website/scripts/capture-native.mjs\`, which runs the actual tools on the programs in \`website/native-examples/\` and on light itself. This capture used scriptc ${tools.scriptc} with light's patches, tsc-ts ${tools.tscTs} and Node ${tools.node}, on ${tools.platform}, on ${tools.capturedAt}. The capture will be run again when scriptc 0.3.7 is released.`,
        },
        {
          kind: "text",
          text: `Timings depend on how busy the machine is. Each capture records the load average when it started (${tools.load} on ${tools.cpus} cores for the overview's captures), and the comparisons between two versions of the same code run them alternately, so both see the same load. Absolute times from a busy machine are higher than from an idle one; the ratios between versions are what the pages compare.`,
        },
        { kind: "note", text: "The browser column uses Node's V8 in place of Chrome's. The engine and its compilers are the same, but these pages include no traces captured in Chrome." },
      ],
    },
  ],
};
