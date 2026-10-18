/**
 * /native/scriptc: how scriptc compiles the examples: its stages, data layout,
 * the machine code beside V8's, reference counting, the runtime it links,
 * values typed unknown or any, unsupported code, coverage reports and the
 * test suite. Every snippet and number is a capture.
 */
import captures from "./captures.js";
import measures from "./measures.js";

const { tools } = captures;
const { counter, shapes, dynamic, refused } = captures.examples;

/** @param {string} text */
const trimmed = (text) => text.trimEnd();

/** The lines of V8's code that jump to a deoptimization exit, as a highlight. */
const deoptJumps = counter.optimized.code
  .split("\n")
  .flatMap((line, index) => (line.includes(";; deopt:") ? [String(index + 1)] : []))
  .join(",");
/** @param {number} bytes */
const kilobytes = (bytes) => `${Math.round(bytes / 1e3)} KB`;

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "How scriptc compiles TypeScript",
  lede: "scriptc compiles TypeScript to a native executable before the program runs. It uses TypeScript's type checker to determine the type of every value, lowers the program to a typed IR, generates LLVM IR and machine code, and links the result with a runtime written in C. Types are checked again at run time only for values whose type is not known at compile time.",
  sections: [
    {
      id: "stages",
      title: "Compiler stages",
      blocks: [
        { kind: "text", text: "A build runs once, before the program runs. Each stage's output can be written to a file." },
        {
          kind: "table",
          columns: [
            { name: "stage", label: "Stage" },
            { name: "does", label: "What it does" },
            { name: "see", label: "Output" },
          ],
          rows: [
            { stage: "Check", does: "TypeScript 7.0.2's type checker, run as a `tsc --api` server, checks the program and answers scriptc's queries about types and narrowing.", see: "type errors stop the build" },
            { stage: "Lower", does: "scriptc converts the checked program to its typed IR: generic functions are specialized for each type they are used with, unions are tagged, closures list their captured variables. The IR is validated.", see: "--emit=ir" },
            { stage: "Generate", does: "The backend generates LLVM IR from the typed IR.", see: "--emit=llvm" },
            { stage: "Optimize", does: "LLVM 22, in scriptc's helper executable, optimizes the IR (-O2 by default) and generates machine code.", see: "--emit=asm, --emit=obj" },
            { stage: "Link", does: "The program's object file is linked with precompiled objects from a runtime pack, selected for the features the program uses.", see: "--print=native-link-info" },
          ],
        },
      ],
    },
    {
      id: "data-layout",
      title: "Data layout",
      blocks: [
        { kind: "text", text: "`Counter` has one field of type `number`. In the IR the field's type is `f64`, and in LLVM IR a `Counter` is a struct of two fields: the reference count and `count`. Reading `this.count` reads 8 bytes at a fixed offset from the start of the object." },
        {
          kind: "compare",
          items: [
            { kind: "code", title: "scriptc build --emit=ir: class Counter (source locations removed)", code: counter.ir.class, language: "json" },
            { kind: "code", title: "scriptc build --emit=llvm: the Counter struct", code: counter.llvm.struct, language: "text" },
          ],
        },
        { kind: "text", text: "A union of two interfaces that share a `kind` field compiles to a tagged union: a value that records which member type it holds (the tag) along with that member's data. Each member is a record with its own layout, and the tag is derived from `kind`: 0 for `\"circle\"`, 1 for `\"square\"`." },
        { kind: "code", title: shapes.file, code: trimmed(shapes.source), language: "ts", highlight: "1-9" },
        {
          kind: "compare",
          items: [
            { kind: "code", title: "scriptc build --emit=ir: unions", code: shapes.ir.unions, language: "json", foldAt: 30 },
            { kind: "code", title: "scriptc build --emit=ir: records", code: shapes.ir.records, language: "json", foldAt: 30 },
          ],
        },
        { kind: "text", text: "A generic function is compiled once for each type it is used with. `total<T>` is only used with `Shape`, so scriptc compiled one function, `total%0`, which takes an array of `u0` (the union) and a function from `u0`:" },
        { kind: "code", title: "scriptc build --emit=ir: the functions and their types", code: shapes.ir.signatures, language: "text" },
      ],
    },
    {
      id: "machine-code",
      title: "Machine code",
      blocks: [
        {
          kind: "text",
          text: "Because every type is known, LLVM's optimizer can inline `increment` into the loop. The loop that calls `increment` 100,000 times compiles to ten unrolled `addsd` instructions on a register, and `count` is written back to the object once, after the loop. Next to it is the code V8's Maglev generated for `increment` (see [type checks in optimized code](/native/javascript#type-checks)).",
        },
        {
          kind: "compare",
          items: [
            { kind: "code", title: "scriptc build --emit=asm: the whole loop, increment inlined", code: counter.loop, language: "text" },
            { kind: "code", title: `node --print-maglev-code: increment (${tools.node})`, code: counter.optimized.code, language: "text", foldAt: 24, highlight: deoptJumps },
          ],
        },
        {
          kind: "text",
          text: "Native code is not faster in every case: V8 optimizes from the types it observes at run time, and on [light's benchmark](/native/how-it-works#benchmark) Node is faster on most steps. The difference is when the code is generated. scriptc's code is complete before the program starts, so it needs no warm-up, does not change while the program runs, and is never deoptimized.",
        },
      ],
    },
    {
      id: "reference-counting",
      title: "Reference counting",
      blocks: [
        {
          kind: "text",
          text: "Every object starts with its reference count, the `i64` in `{ i64, double }`: the number of references to the object that exist. Code that stops using an object releases it, which decrements the count, and the release that brings the count to zero frees the object. This is the release function scriptc generated for `Counter`:",
        },
        { kind: "code", title: "scriptc build --emit=llvm: sc_release_Counter", code: counter.llvm.release, language: "text" },
        {
          kind: "text",
          text: "When the count is two or more, the release only decrements it. The last release goes to the slow path, which frees the object. A count of -1 marks an object that is never freed. Reference counts cannot free a cycle (objects that refer to each other), so the runtime also runs a cycle collector at defined points. When the program ends, the process exits without freeing the memory it still holds, and the operating system reclaims it.",
        },
      ],
    },
    {
      id: "runtime",
      title: "Runtime",
      blocks: [
        { kind: "text", text: "The executable contains the program and the parts of scriptc's runtime it uses: precompiled objects from a runtime pack, selected for the program's features. The link checks the runtime's ABI version." },
        {
          kind: "stats",
          items: [
            { title: "Runtime pack", value: counter.link.target, desc: `${counter.link.pack}, ${counter.link.flavor} flavor` },
            { title: "ABI", value: counter.link.abi.replace("scr_runtime_abi_", ""), desc: "checked at link time" },
            { title: "counter, linked", value: kilobytes(counter.runs.native.sizeBytes), desc: `${kilobytes(counter.runs.native.strippedBytes)} stripped` },
          ],
        },
        {
          kind: "list",
          items: [
            "An event loop on epoll (kqueue on macOS) for timers, I/O and microtasks. In scriptc 0.3.6, `async` functions run on fibers.",
            "Native implementations of the Node APIs a program calls: files, processes, `net`, `http`, `https`, `tls` (with a vendored mbedTLS), `dgram` and `dns`.",
            "Numbers stored as doubles and printed with shortest round-trip formatting, tested against Node. Regular expressions and Unicode support from QuickJS's libraries, linked only into programs that use them.",
          ],
        },
      ],
    },
    {
      id: "dynamic-values",
      title: "Values typed unknown or any",
      blocks: [
        { kind: "text", text: "scriptc stores values typed `unknown` or `any` in a checked dynamic representation, which records each value's type at run time. Casting such a value to a type checks the value against that type. TypeScript under Node does not check casts, so this program behaves differently:" },
        { kind: "code", title: dynamic.file, code: trimmed(dynamic.source), language: "ts", highlight: "2" },
        {
          kind: "compare",
          items: [
            { kind: "code", title: `node: exit ${dynamic.node.status}`, code: trimmed(dynamic.node.stdout + dynamic.node.stderr), language: "text" },
            { kind: "code", title: `native (scriptc): exit ${dynamic.native.status}`, code: trimmed(dynamic.native.stdout + dynamic.native.stderr), language: "text" },
          ],
        },
        {
          kind: "text",
          text: "Node does not check the cast and prints `many1`, the string `\"many\"` concatenated with `1`. The executable checks the cast and throws a `TypeError` that names the field, before it prints anything. scriptc documents this difference under [runtime type checks](https://scriptc.dev/docs/limitations#runtime-type-checks). It is the only example on these pages whose output differs between the two.",
        },
      ],
    },
    {
      id: "unsupported-code",
      title: "Unsupported code",
      blocks: [
        { kind: "text", text: `\`eval\` runs code that only exists when the program runs, so it cannot be compiled ahead of time. Node runs this program and prints ${refused.node.stdout.trim()}. scriptc stops the build with a diagnostic that names the line and gives the reason:` },
        { kind: "code", title: refused.file, code: trimmed(refused.source), language: "ts" },
        { kind: "code", title: `scriptc build ${refused.file}: exit ${refused.build.status}`, code: trimmed(refused.build.stderr), language: "text" },
        { kind: "text", text: "In TypeScript, code scriptc cannot compile stops the build. In JavaScript, some such code is compiled to a run-time error instead; coverage reports these sites as deferred." },
      ],
    },
    {
      id: "coverage",
      title: "Coverage reports",
      blocks: [
        { kind: "text", text: "`scriptc coverage` analyzes a program without building it. It reports how many statements compile statically and lists what blocks the rest:" },
        {
          kind: "compare",
          items: [
            { kind: "code", title: "scriptc coverage counter.ts", code: counter.coverage, language: "text" },
            { kind: "code", title: "scriptc coverage refused.ts", code: refused.coverage, language: "text" },
          ],
        },
        { kind: "text", text: "With light's patches, coverage also reports code that compiles but makes method calls slower, and light's builds fail on it. See [writes with string keys and method calls](/native/how-it-works#slow-paths)." },
      ],
    },
    {
      id: "testing",
      title: "Testing",
      blocks: [
        {
          kind: "text",
          text: `scriptc's test suite runs each program in its corpus${measures.corpus ? ` (${measures.corpus.toLocaleString("en-US")} programs in the scriptc build these pages used)` : ""} under Node and as a compiled executable, and requires the same stdout, stderr and exit code, byte for byte. The same programs also run with AddressSanitizer and a reference-count audit at exit, which detect leaks and memory errors.`,
        },
        { kind: "note", title: "Scope", text: "Passing tests show that the tested cases behave as under Node; they do not show that every program does." },
      ],
    },
  ],
};
