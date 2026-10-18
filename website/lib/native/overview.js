/**
 * The /native overview's words: how one program runs in a browser, in Node and
 * native (scriptc), as the lanes of an `lc-flow`; what each step does with the
 * program and which captured output shows it; and the table of differences.
 * Pure data over `captures.js`; the page draws it.
 */
import captures from "./captures.js";
import { describeRun } from "./v8-trace.js";

/** @import { FlowLane } from "@bootstrapp/light/components/types.ts" */

const counter = captures.examples.counter;
const { tools } = captures;
export const EXAMPLE = counter;
export const TOOLS = tools;

/** @param {number} bytes */
export const megabytes = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
/** @param {number} bytes */
const kilobytes = (bytes) => `${Math.round(bytes / 1e3)} KB`;

export const PHASES = ["Source", "Types", "Build", "Run"];

/** @type {FlowLane[]} */
export const LANES = [
  {
    id: "browser",
    label: "Browser",
    detail: "a tab",
    steps: [
      { id: "browser-source", label: counter.file, detail: "TypeScript", phase: 0 },
      { id: "browser-check", label: "tsc-ts", detail: "type check, JavaScript output", phase: 1 },
      { id: "browser-ignition", label: "Bytecode", detail: "V8 Ignition", phase: 3 },
      { id: "browser-tiers", label: "Optimized", detail: "Maglev, TurboFan", phase: 3 },
    ],
  },
  {
    id: "node",
    label: "Node",
    detail: "a process",
    steps: [
      { id: "node-source", label: counter.file, detail: "TypeScript", phase: 0 },
      { id: "node-strip", label: "Type stripping", detail: "no type check", phase: 1 },
      { id: "node-ignition", label: "Bytecode", detail: "V8 Ignition", phase: 3 },
      { id: "node-tiers", label: "Optimized", detail: "Maglev, TurboFan", phase: 3 },
    ],
  },
  {
    id: "scriptc",
    label: "Native (scriptc)",
    detail: "an executable",
    steps: [
      { id: "scriptc-source", label: counter.file, detail: "TypeScript", phase: 0 },
      { id: "scriptc-check", label: "Type checker", detail: "TypeScript 7", phase: 1, tone: "accent" },
      { id: "scriptc-ir", label: "Typed IR", phase: 2 },
      { id: "scriptc-llvm", label: "LLVM IR", phase: 2 },
      { id: "scriptc-asm", label: "Machine code", detail: "LLVM -O2", phase: 2 },
      { id: "scriptc-run", label: "Executable", detail: kilobytes(counter.runs.native.sizeBytes), phase: 3, tone: "accent" },
    ],
  },
];

/**
 * @typedef {object} StepArtifact
 * @property {string} title
 * @property {string} code
 * @property {string} language
 * @property {string} [highlight]
 * @property {number} [foldAt]
 */

/**
 * @typedef {object} StepPage
 * @property {string} title
 * @property {string[]} text
 * @property {StepArtifact[]} artifacts
 * @property {{ label: string, href: string }} [more] the page that covers the step in detail
 */

const source = {
  title: counter.file,
  text: [
    "The example is a class with one number field and one method. The program calls the method 100,000 times and prints the total.",
    "Each step in the diagram shows what one environment does with this file, with the output of the tool involved.",
  ],
  artifacts: [{ title: counter.file, code: counter.source.trimEnd(), language: "ts" }],
};

const ignition = {
  title: "V8: bytecode",
  text: [
    "V8 compiles each function to bytecode the first time the function runs, and its interpreter, Ignition, executes the bytecode. `this.count += by` compiles to `GetNamedProperty`, `Add` and `SetNamedProperty`. The property is looked up by its name, `count`, which is entry 0 of the constant pool.",
    "The last operand of these instructions (`[0]`, `[2]`, `[3]`) is a feedback slot, where V8 records the object shapes and number types the instruction sees at run time. Chrome and Node use the same V8, so the bytecode is the same in both.",
  ],
  artifacts: [{ title: `node --print-bytecode, increment (${tools.node}, addresses removed)`, code: counter.bytecode, language: "text" }],
  more: { label: "How V8 runs JavaScript", href: "/native/javascript#bytecode" },
};

const tiers = {
  title: "V8: optimizing compilers",
  text: [
    "When a function has run often enough, V8 compiles it to machine code with one of its optimizing compilers: Maglev, which compiles quickly, or TurboFan, which takes longer and optimizes more. Both compile for the types recorded in the feedback slots. A loop that is already running can switch to optimized code (on-stack replacement).",
    describeRun(counter.tiers),
  ],
  artifacts: [{ title: `node --trace-opt --trace-deopt (${tools.node}, the example's own functions)`, code: counter.tiers, language: "text" }],
  more: { label: "How V8 runs JavaScript", href: "/native/javascript#optimizing-compilers" },
};

/** @type {Record<string, StepPage>} */
export const STEPS = {
  "browser-source": source,
  "node-source": source,
  "scriptc-source": source,
  "browser-check": {
    title: "tsc-ts: type check and JavaScript output",
    text: [
      "For the browser, TypeScript is compiled ahead of time. The compiler checks the types and writes JavaScript without them: `increment(by: number): number` becomes `increment(by)`. Here the compiler is tsc-ts, a port of TypeScript 7 to TypeScript that scriptc compiles to a native executable.",
      "The browser receives JavaScript with no type information. This site's development server does the same when it serves a .ts file: it replaces the annotations with spaces.",
    ],
    artifacts: [{ title: `${counter.file.replace(".ts", ".js")}, written by tsc-ts ${tools.tscTs}`, code: counter.javascript.trimEnd(), language: "js" }],
    more: { label: "tsc-ts", href: "/native/tsc-ts" },
  },
  "browser-ignition": ignition,
  "browser-tiers": tiers,
  "node-strip": {
    title: "Node: type stripping",
    text: [
      "Recent versions of Node run .ts files directly. Before parsing, Node replaces each type annotation with spaces, so line and column numbers in stack traces still match the source. It does not check the types.",
      "Node then runs the JavaScript in V8, as Chrome does, with libuv for files, sockets and timers.",
    ],
    artifacts: [{ title: `module.stripTypeScriptTypes(${counter.file}) (${tools.node})`, code: counter.stripped.trimEnd(), language: "js", highlight: "4" }],
    more: { label: "How V8 runs JavaScript", href: "/native/javascript#v8" },
  },
  "node-ignition": ignition,
  "node-tiers": tiers,
  "scriptc-check": {
    title: "Native (scriptc): type checking",
    text: [
      "scriptc uses TypeScript 7's type checker, through its `tsc --api` server, and compiles the program from the types it reports: `count` is a number, `by` is a number, `counter` is always a `Counter`. tsc-ts implements the same API.",
      "When a type is not precise enough to compile directly, such as a value typed `any` or a property added at run time, scriptc either stores the value in a checked dynamic representation or stops with a diagnostic that names the line.",
    ],
    artifacts: [{ title: `${counter.file} (highlighted: the types the compiled code depends on)`, code: counter.source.trimEnd(), language: "ts", highlight: "2,4" }],
    more: { label: "How scriptc compiles TypeScript", href: "/native/scriptc#stages" },
  },
  "scriptc-ir": {
    title: "Native (scriptc): typed IR",
    text: [
      "scriptc lowers the checked program to its intermediate representation (IR), in which every value has a concrete type. `Counter` is a class with one field, `count`, of type `f64` (a 64-bit float). `increment` takes a `Counter` and an `f64` and returns an `f64`.",
      "`this.count += by` is a `fieldGet`, a `bin` with `+` and a `fieldSet` on class `Counter`. The field is identified by its position in the class layout; there is no lookup by name.",
    ],
    artifacts: [
      { title: "scriptc build --emit=ir: class Counter (source locations removed)", code: counter.ir.class, language: "json" },
      { title: "scriptc build --emit=ir: increment", code: counter.ir.method, language: "json", foldAt: 24 },
    ],
    more: { label: "Data layout", href: "/native/scriptc#data-layout" },
  },
  "scriptc-llvm": {
    title: "Native (scriptc): LLVM IR",
    text: [
      "scriptc's backend generates LLVM IR. `Counter` is a struct with two fields, `{ i64, double }`: the reference count and `count`. Reading `this.count` is a `getelementptr` to field 1 followed by a `load double`.",
      "scriptc also generated a version of `increment` that takes `by` as a 32-bit integer (`.i32`), and the loop calls that version with `i32 2`. This IR is not optimized yet, so every local variable still has its own stack slot.",
    ],
    artifacts: [
      { title: "scriptc build --emit=llvm: the Counter struct", code: counter.llvm.struct, language: "text" },
      { title: "scriptc build --emit=llvm: the call in the loop", code: counter.llvm.call, language: "text" },
      { title: "scriptc build --emit=llvm: increment", code: counter.llvm.functions, language: "text", foldAt: 20 },
    ],
    more: { label: "Data layout", href: "/native/scriptc#data-layout" },
  },
  "scriptc-asm": {
    title: "Native (scriptc): machine code",
    text: [
      "LLVM's optimizer (scriptc builds with -O2 by default) inlined `increment` into the loop. The loop keeps `count` in a register (`%xmm0`), adds 2 to it ten times per iteration (`addsd`, unrolled) and counts down by ten. `count` is written back to the object once, after the loop.",
      "The loop contains no type or shape checks, because the types were known at compile time. The code does not change while the program runs.",
    ],
    artifacts: [{ title: "scriptc build --emit=asm: the loop (x86-64)", code: counter.loop, language: "text" }],
    more: { label: "Machine code", href: "/native/scriptc#machine-code" },
  },
  "scriptc-run": {
    title: "Native (scriptc): the executable",
    text: [
      `The executable includes scriptc's runtime, written in C: reference counting with a cycle collector, an event loop on epoll (kqueue on macOS), and the parts of Node's API the program uses. It is ${counter.runs.native.sizeBytes.toLocaleString("en-US")} bytes, ${counter.runs.native.strippedBytes.toLocaleString("en-US")} stripped.`,
      `It prints ${counter.runs.stdout.trim()}, the same as Node. scriptc's test suite requires each of its test programs to produce the same stdout, stderr and exit code under Node and as an executable.`,
    ],
    artifacts: [],
    more: { label: "Runtime", href: "/native/scriptc#runtime" },
  },
};

/** The table under the flow: one row per difference. */
export const DIFFERENCES = [
  {
    aspect: "Types",
    javascript: "Checked by a separate build step, or not at all, then removed",
    scriptc: "Checked, then used to decide how each value is stored",
  },
  {
    aspect: "Machine code",
    javascript: "Generated while the program runs, from observed types; discarded when those types change",
    scriptc: "Generated before the program runs, from the checked types; does not change",
  },
  {
    aspect: "Unsupported code",
    javascript: "None: any valid JavaScript runs",
    scriptc: "Rejected with a diagnostic, or compiled with run-time checks",
  },
  {
    aspect: "Memory",
    javascript: "Garbage collector",
    scriptc: "Reference counting and a cycle collector",
  },
  {
    aspect: "Size",
    javascript: `The engine: the node executable is ${megabytes(counter.runs.node.sizeBytes)}`,
    scriptc: `The executable: ${kilobytes(counter.runs.native.sizeBytes)}, including the runtime`,
  },
];

/** The measured runs of the example, for the stats under the table. */
export const RUNS = counter.runs;
