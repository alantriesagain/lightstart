/**
 * /native/issues: open issues in light's native build and in scriptc: performance
 * against Node, scriptc's releases, JSDoc-typed JavaScript, intentional
 * differences from Node, tsc-ts's status, and how these pages are generated.
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
      title: "scriptc status",
      blocks: [
        {
          kind: "text",
          text: "While scriptc releases lacked fixes light's TypeScript core needed, light's native tools ran a fork of the compiler. Since scriptc 0.4.12 every fix light needed has landed upstream, and light builds with the stock release that `package.json` pins; the fork is no longer used.",
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
          text: `Every snippet and number on these pages comes from \`website/scripts/capture-native.mjs\`, which runs the actual tools on the programs in \`website/native-examples/\` and on light itself. This capture used scriptc ${tools.scriptc} with light's patches (the fork light used then), tsc-ts ${tools.tscTs} and Node ${tools.node}, on ${tools.platform}, on ${tools.capturedAt}. The capture will be run again when the tools it names change.`,
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
