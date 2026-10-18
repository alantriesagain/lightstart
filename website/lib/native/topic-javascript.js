/**
 * /native/javascript: how V8 runs the examples in Chrome and in Node: bytecode,
 * type feedback, the optimizing compilers and the type checks in their code,
 * deoptimization and garbage collection. Every snippet is a capture.
 */
import captures from "./captures.js";
import { bailouts, describeRun } from "./v8-trace.js";

const { tools } = captures;
const { counter, shapes } = captures.examples;

/** @param {string} text */
const trimmed = (text) => text.trimEnd();

/** The 1-based numbers of the lines that hold `mark`, as an `lc-code-block` highlight. @param {string} code @param {string} mark */
const linesWith = (code, mark) =>
  code
    .split("\n")
    .flatMap((line, index) => (line.includes(mark) ? [String(index + 1)] : []))
    .join(",");

const deoptJumps = linesWith(counter.optimized.code, ";; deopt:");
const shapeBailouts = bailouts(shapes.deopts);
const deoptimized = [...new Set(shapeBailouts.map((b) => `\`${b.fn}\``))].join(" and ");
const reasons = [...new Set(shapeBailouts.map((b) => b.reason))].join(", ");

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "How V8 runs JavaScript",
  lede: "Chrome and Node run JavaScript with the same engine, V8. V8 receives no type information: it compiles from the source text and collects types while the program runs. This page follows the overview's `counter.ts`, then `shapes.ts`, through V8.",
  sections: [
    {
      id: "v8",
      title: "V8 in Chrome and in Node",
      blocks: [
        {
          kind: "text",
          text: "Chrome and Node both embed V8 and differ in what they provide around it. Chrome provides the DOM, rendering and the page's event loop. Node provides libuv (files, sockets, timers, child processes) and its own module loader. Both use the same parser and the same compilers, so everything on this page applies to both.",
        },
        {
          kind: "stats",
          items: [
            { title: "Node", value: tools.node, desc: "the version these captures ran in" },
            { title: "V8", value: tools.v8.split("-")[0], desc: "the engine in that version" },
            { title: "libuv", value: tools.uv, desc: "Node's event loop and I/O" },
          ],
        },
      ],
    },
    {
      id: "bytecode",
      title: "Bytecode",
      blocks: [
        {
          kind: "text",
          text: "The browser receives JavaScript with the types already removed, and Node removes them itself. V8 parses the program and compiles each function to bytecode the first time the function runs. Its interpreter, Ignition, executes the bytecode.",
        },
        { kind: "code", title: `node --print-bytecode, increment (${tools.node}, addresses removed)`, code: counter.bytecode, language: "text" },
        {
          kind: "text",
          text: "`this.count += by` compiles to `GetNamedProperty`, `Add` and `SetNamedProperty`. The property is looked up by its name, `count`, which is entry 0 of the constant pool. The last operand of each of these instructions (`[0]`, `[2]`, `[3]`, `[5]`) is a feedback slot. Each time the instruction runs, V8 records in the slot what it saw: the object's hidden class (V8 calls it a map) and whether the numbers were small integers. This record is the type feedback the optimizing compilers use.",
        },
      ],
    },
    {
      id: "optimizing-compilers",
      title: "Optimizing compilers",
      blocks: [
        {
          kind: "text",
          text: "When a function has run often enough, V8 compiles it again to machine code with one of its two optimizing compilers. Maglev compiles quickly; TurboFan takes longer and optimizes more. Both compile for the types in the feedback slots, on the assumption that the function will keep seeing those types. A loop that is already running can switch to optimized code while it runs, which V8 calls on-stack replacement (OSR).",
        },
        { kind: "code", title: `node --trace-opt --trace-deopt, counter.ts (${tools.node}, the example's own functions)`, code: counter.tiers, language: "text" },
        { kind: "text", text: describeRun(counter.tiers) },
      ],
    },
    {
      id: "type-checks",
      title: "Type checks in optimized code",
      blocks: [
        {
          kind: "text",
          text: "This is the machine code Maglev generated for `increment`. Before it reads `count`, it checks that `this` is an object (`test al,0x1`) and that the object's map is the one recorded in the feedback slot (`cmpq [rax-0x1],r10`). It checks that `by` is a Smi, V8's representation of a small integer, stored shifted 32 bits to the left (hence `shrq` before the add and `shlq` after). After the add, it checks for overflow (`jo`). When a check fails, the code jumps to a deoptimization exit; the exits are labelled with the reason V8 records for each.",
        },
        { kind: "code", title: `node --print-maglev-code, increment (${tools.node}, addresses removed, jumps to a deoptimization exit labelled)`, code: counter.optimized.code, language: "text", highlight: deoptJumps },
        {
          kind: "text",
          text: `${deoptJumps.split(",").length} jumps in the function body go to a deoptimization exit. V8 compiled this code for the types it observed, so it checks those types on every call. [scriptc's code for the same method](/native/scriptc#machine-code) has no such checks, because the types are known when it compiles.`,
        },
      ],
    },
    {
      id: "deoptimization",
      title: "Deoptimization",
      blocks: [
        {
          kind: "text",
          text: "Deoptimization is what happens when one of those checks fails: V8 discards the optimized code and continues the function in bytecode. `shapes.ts` computes the total area of a list of shapes twice: first when the list holds only circles, then after squares are added. `area` and `total` are optimized while every shape is a circle, so their code checks for the circle's map.",
        },
        { kind: "code", title: shapes.file, code: trimmed(shapes.source), language: "ts", highlight: "11-13,22-25" },
        {
          kind: "text",
          text: `When the first square arrives, those checks fail. ${deoptimized} deoptimize (${reasons}), run in bytecode while V8 collects feedback that includes both maps, and are then optimized again.`,
        },
        { kind: "code", title: `node --trace-opt --trace-deopt, shapes.ts (${tools.node}, area and total)`, code: shapes.deopts, language: "text" },
        { kind: "note", title: "Output", text: `The program prints the same two totals under Node and as a scriptc executable: ${shapes.stdout.trim().split("\n").join(" and ")}.` },
      ],
    },
    {
      id: "garbage-collection",
      title: "Garbage collection",
      blocks: [
        {
          kind: "text",
          text: "JavaScript programs do not free memory themselves; V8's garbage collector does. New objects are allocated in a small young generation. When it fills up, V8 copies the objects that are still reachable out of it, which is called a scavenge. Objects that survive long enough are moved to the old generation, which a full mark-compact collection cleans. Each collection pauses the program, for a time that depends on how much memory is still in use.",
        },
        { kind: "code", title: `node --trace-gc, shapes.ts (${tools.node}, the first collections)`, code: shapes.gc, language: "text" },
        {
          kind: "text",
          text: "Each line is one collection: the time since the program started, the memory in use before and after, and the length of the pause. scriptc programs use [reference counting](/native/scriptc#reference-counting) instead, which frees each object when its last reference is dropped.",
        },
      ],
    },
  ],
};
