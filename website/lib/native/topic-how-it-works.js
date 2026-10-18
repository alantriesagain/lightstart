/**
 * /native/how-it-works: how light's native build works: what compiles, the
 * coverage check, which scriptc it uses and the patches, the benchmark against
 * Node, the move of its core to TypeScript, and writes with string keys and
 * method calls. Measured numbers are `measures.js` and `captures.js`;
 * light's history is quoted from `native/README.md` with its dates, and the
 * patches from the scriptc fork's FORK.md.
 */
import captures from "./captures.js";
import measures from "./measures.js";

const { methods } = captures.examples;
const { bench, coverage } = measures;

/** @param {number} bytes */
const megabytes = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
/** @param {number} ms */
const ms = (ms) => `${ms.toFixed(1)}\u00a0ms`;

const faster = bench.steps.filter((step) => step.native < step.node).map((step) => step.step);

/** @param {string} source */
const replaceableLine = (source) => source.split("\n").findIndex((line) => line.includes("settings[key] = value")) + 1;

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "How light's native build works",
  lede: "Light's signals, html engine, view core and terminal host compile to a native executable with scriptc. This page covers what compiles, how light checks it, which scriptc it needs, how it performs compared with Node, and the changes light made to compile well.",
  sections: [
    {
      id: "what-compiles",
      title: "What compiles",
      blocks: [
        {
          kind: "text",
          text: "The entry point is `native/index.js`. It re-exports light's html core, signals and view core, and installs a terminal host (`tdom/`) under the view engine. Components then render into a tree of terminal nodes instead of the DOM, which `tdom/` lays out and paints as text in a terminal. The same code runs under Node and as an executable, so a component can be tested under Node and shipped as a binary.",
        },
        {
          kind: "text",
          text: "The desktop shell (`native/desktop/`) is the other native host. Its backend is JavaScript compiled by scriptc into an executable, and its UI is a light page shown in the operating system's web view (WebKitGTK on Linux, WKWebView on macOS, WebView2 on Windows). The two sides talk over one typed bridge. No Node and no browser engine are bundled.",
        },
      ],
    },
    {
      id: "coverage-check",
      title: "Coverage check",
      blocks: [
        {
          kind: "text",
          text: `\`npm run coverage:native\` runs \`scriptc coverage\` on \`native/index.js\` with \`--fail-on=slow-paths\` and fails unless every statement compiles statically and no write makes method calls dynamic. All ${coverage.statements.toLocaleString("en-US")} statements do. \`coverage:tasks\` checks the tasks example the same way, except that its JSDoc-typed JavaScript may compile partly dynamically.`,
        },
        { kind: "code", title: "scriptc coverage native/index.js --fail-on=slow-paths", code: coverage.text, language: "text" },
      ],
    },
    {
      id: "which-scriptc",
      title: "Which scriptc",
      blocks: [
        {
          kind: "text",
          text: "Light needs fixes that no scriptc release has yet, so its native tools run a fork: the latest release plus one branch per fix, each submitted upstream separately. `native/scriptc.js` decides which scriptc the tools run: the one named by the `SCRIPTC` environment variable, then the one in light's `node_modules`, then the one on `PATH`. As of 2026-10-18, upstream has implemented its own versions of three of the fixes, which are not in a release yet:",
        },
        {
          kind: "table",
          columns: [
            { name: "patch", label: "Patch", code: true },
            { name: "fixes", label: "What it fixes" },
            { name: "light", label: "Why light needed it" },
            { name: "upstream", label: "Upstream" },
          ],
          rows: [
            { patch: "ts-unknown-fields", fixes: "Class fields typed unknown or object compile, in checked dynamic storage", light: "Template values, host nodes and committed values are unknown", upstream: "#1208 covers it, except (object | null)[] fields" },
            { patch: "generic-unknown-fields", fixes: "Fields typed by a type parameter compile when it is bound to unknown", light: "Signal<T> is built with unknown values", upstream: "Still needed" },
            { patch: "generic-method-slots", fixes: "Methods of generic classes are found when a write can replace methods", light: "Signal<T> crashed natively: this._track is not a function", upstream: "#1215 covers it, except reads through a non-generic base type" },
            { patch: "census-typed-keys", fixes: "A key asserted to a number (i as number, i!) only marks numeric names", light: "One write made all 176 methods dispatch dynamically", upstream: "#1218 covers light's case" },
            { patch: "census-report", fixes: "Coverage reports writes that make methods replaceable (SC7001)", light: "Coverage said fully static while every call was slower", upstream: "Still needed (#1149 open)" },
            { patch: "generic-record-return", fixes: "A JSDoc generic whose return type does not map returns a checked dynamic value", light: "Every model definition was refused (SC2009)", upstream: "Still needed" },
            { patch: "async-return-union", fixes: "Promise.all's result is possibly undefined only when an entry can be", light: "Loading related rows with Promise.all did not build", upstream: "Still needed" },
            { patch: "async-dynamic-return", fixes: "An async function resolves a returned dynamic promise", light: "The store's dynamic returns failed at run time", upstream: "Still needed" },
          ],
        },
        { kind: "text", text: "When scriptc 0.3.7 is released, the fork can drop the patches upstream covers, once light's own checks pass without them. See [fork status](/native/issues#fork) in the open issues." },
      ],
    },
    {
      id: "benchmark",
      title: "Benchmark",
      blocks: [
        { kind: "text", text: `\`native/bench.js\` renders 10,000 keyed rows into a terminal tree, lays them out, relabels every tenth row, reverses the rows and clears them. The table shows the fastest of three runs under Node and as a ${megabytes(bench.sizeBytes)} stripped executable:` },
        {
          kind: "table",
          columns: [
            { name: "step", label: "Step" },
            { name: "node", label: "Node" },
            { name: "native", label: "Native" },
          ],
          rows: bench.steps.map((step) => ({ step: step.step, node: ms(step.node), native: ms(step.native) })),
        },
        {
          kind: "text",
          text: `The executable is faster at ${faster.length ? faster.join(" and ") : "none of the steps"} and slower at the others. Layout runs in the terminal host, the first part of light moved to TypeScript. The other steps run through light's engine. According to light's notes, most of their remaining time is boxing (wrapping class instances so they can pass through \`unknown\`-typed values such as template values and host nodes, then releasing them) and the cycle collector. See [performance](/native/issues#performance) in the open issues.`,
        },
      ],
    },
    {
      id: "typescript",
      title: "Moving the core to TypeScript",
      blocks: [
        {
          kind: "text",
          text: "Light was written in JavaScript with JSDoc types. In scriptc, a class defined in a JavaScript file does extra bookkeeping on every field write once its instances are stored in an `unknown`, and JSDoc-typed classes compiled 70 to 160 times slower than the same classes in TypeScript ([vercel-labs/scriptc#934](https://github.com/vercel-labs/scriptc/issues/934)). Light moved its core to TypeScript one layer at a time and measured each step. These numbers are from light's `native/README.md`, 2026-10-13, medians of three runs:",
        },
        {
          kind: "table",
          columns: [
            { name: "step", label: "Step" },
            { name: "node", label: "Node" },
            { name: "js", label: "all JavaScript" },
            { name: "host", label: "host in TypeScript" },
            { name: "core", label: "core in TypeScript" },
            { name: "write", label: "one write fixed" },
          ],
          rows: [
            { step: "create 10k keyed rows", node: "72 ms", js: "3634 ms", host: "1459 ms", core: "611 ms", write: "90 ms" },
            { step: "layout 10k rows", node: "41 ms", js: "948 ms", host: "23 ms", core: "19 ms", write: "12 ms" },
            { step: "update every 10th row", node: "9 ms", js: "185 ms", host: "179 ms", core: "101 ms", write: "26 ms" },
            { step: "reverse 10k keyed rows", node: "21 ms", js: "534 ms", host: "403 ms", core: "328 ms", write: "44 ms" },
            { step: "clear", node: "11 ms", js: "384 ms", host: "160 ms", core: "66 ms", write: "21 ms" },
          ],
        },
        {
          kind: "text",
          text: "The last column comes from a one-line change, described in the next section. scriptc's main branch now compiles JavaScript classes the way it compiles TypeScript classes when their layout or JSDoc types allow it (#1232); no release includes it yet.",
        },
      ],
    },
    {
      id: "slow-paths",
      title: "Writes with string keys and method calls",
      blocks: [
        {
          kind: "text",
          text: "JavaScript allows replacing a method at run time: `obj[\"increment\"] = fn` is valid. When a program contains a write whose key can be any string, scriptc cannot prove that the write never replaces a method. It then compiles every method call in the program as a dynamic call: the call reads the method from the instance and boxes the receiver. One such write anywhere in the program is enough. The three example programs differ only in a `save` helper, which is never called with a method name:",
        },
        {
          kind: "compare",
          items: [
            { kind: "code", title: methods.replaceable.file, code: methods.replaceable.source.trimEnd(), language: "ts", highlight: String(replaceableLine(methods.replaceable.source)) },
            { kind: "code", title: "scriptc coverage --fail-on=slow-paths", code: methods.replaceable.coverage, language: "text" },
          ],
        },
        {
          kind: "bars",
          title: "Time for 10 million increment calls, native (scriptc), in milliseconds",
          data: [
            { label: "no save helper", value: Math.round(methods.direct.nativeMs) },
            { label: "save into a Record", value: Math.round(methods.replaceable.nativeMs) },
            { label: "save into a Map", value: Math.round(methods.map.nativeMs) },
          ],
        },
        {
          kind: "text",
          text: `The native loop takes ${ms(methods.direct.nativeMs)} without the helper, ${ms(methods.replaceable.nativeMs)} when the helper writes into a \`Record\` with a \`string\` key, and ${ms(methods.map.nativeMs)} when it writes into a \`Map\`. Under Node, all three take between ${ms(Math.min(methods.direct.nodeMs, methods.replaceable.nodeMs, methods.map.nodeMs))} and ${ms(Math.max(methods.direct.nodeMs, methods.replaceable.nodeMs, methods.map.nodeMs))}: V8 already checks the object's map on every call, so the write adds no work.`,
        },
        {
          kind: "text",
          text: "In light, the write was `oldParts[(oldIndex as number)] = null` in the html engine. scriptc read the key's type from before the `as number` cast, `number | undefined`, which it treats as a key that can be any string, so all 176 of light's methods were called dynamically, about seven times slower. Two of the fork's patches address this: one reads the key's type after the cast, and one makes coverage report such writes (the SC7001 note above). Light's checks run coverage with `--fail-on=slow-paths`, so a new write of this kind fails them.",
        },
      ],
    },
  ],
};
