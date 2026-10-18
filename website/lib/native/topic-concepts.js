/**
 * /native/concepts: the ideas the other native pages rely on, for developers
 * who know JavaScript but not how engines and compilers store values and
 * manage memory. It starts from what JavaScript shows and introduces one idea
 * at a time; every example is a capture from another page.
 */
import captures from "./captures.js";
import typesCaptured from "./captures-types.js";

const { counter, shapes } = captures.examples;
const types = typesCaptured.examples;

/**
 * The line that holds `mark` and the `count - 1` lines after it, 1-based, as
 * an `lc-code-block` highlight.
 * @param {string} code @param {string} mark @param {number} count
 */
const linesFrom = (code, mark, count) => {
  const at = code.split("\n").findIndex((line) => line.includes(mark));
  return at < 0 ? "" : `${at + 1}-${at + count}`;
};

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "Concepts for native code",
  lede: "JavaScript does not show how values are stored or when memory is freed: the engine decides while the program runs. scriptc has to decide both before the program runs. This page explains the ideas the other pages use, starting from what JavaScript shows.",
  sections: [
    {
      id: "compile-time-and-run-time",
      title: "Compile time and run time",
      blocks: [
        {
          kind: "text",
          text: "When Node runs a `.js` file, it reads the source and runs it in one step, and V8 compiles parts of the program to machine code while it runs. scriptc splits these steps. At **compile time**, before anything runs, it reads the whole program and writes an executable. At **run time**, the executable runs on its own: no compiler and no source code are left.",
        },
        {
          kind: "text",
          text: "This changes where the information comes from. V8 can watch the program and see what values actually appear. scriptc cannot: everything it knows about a value, it has to work out from the source code, mostly from the types.",
        },
      ],
    },
    {
      id: "types",
      title: "What a type tells the compiler",
      blocks: [
        {
          kind: "text",
          text: "In JavaScript, a variable can hold any value, and the same variable can hold a number now and a string later. Code that uses the variable has to check what it holds before it can do anything with it.",
        },
        {
          kind: "text",
          text: "A TypeScript type limits what a variable can hold. `count: number` means `count` always holds a number, so scriptc can store it as a plain 64-bit number (an `f64`) and use the processor's number instructions on it without checking first. This is the main thing scriptc uses types for: deciding how each value is stored, and skipping checks the type makes unnecessary.",
        },
        { kind: "code", title: "scriptc build --emit=ir: class Counter (source locations removed)", code: counter.ir.class, language: "json" },
      ],
    },
    {
      id: "boxes",
      title: "Values and boxes",
      blocks: [
        {
          kind: "text",
          text: "A number fits in 8 bytes, and a variable typed `number` holds those 8 bytes directly. A value typed `boolean | string` is different: it can be either, so it also has to record which one it is. scriptc stores such a value in a **box**: a small block of memory that holds a tag (which type the value has) and the value itself.",
        },
        {
          kind: "text",
          text: "A value stored directly is **unboxed**; a value in a box is **boxed**. Boxes cost something: creating one allocates memory, and reading the value means reading the tag first. In `typeof value === \"string\"` below, the compiled code loads the tag from the box (`getelementptr inbounds %ScrUnion`) and compares it with the tag for strings.",
        },
        { kind: "code", title: "scriptc build --emit=llvm: weight, from types and operations (highlighted: reading and comparing the tag)", code: types.union.llvm.weight ?? "", language: "text", foldAt: 16, highlight: linesFrom(types.union.llvm.weight ?? "", "getelementptr inbounds %ScrUnion", 3) },
        {
          kind: "text",
          text: "Not every union needs a box. `string | undefined` and `User | null` are stored as a pointer that can be empty, because the empty pointer already says which case it is ([optional and nullable values](/native/types#optional)). V8 boxes too: it stores small integers directly and most other numbers in separate heap objects, and it decides this at run time rather than from types.",
        },
      ],
    },
    {
      id: "stack-heap-references",
      title: "The stack, the heap and references",
      blocks: [
        {
          kind: "text",
          text: "A running program keeps data in two places. The **stack** holds each function's local variables while the function runs; that space is reused as soon as the function returns. The **heap** holds data that has to outlive a single call, such as objects. Code refers to something on the heap through a **reference** (also called a pointer): the memory address where the data is.",
        },
        {
          kind: "text",
          text: "JavaScript always works with references to objects: assigning an object to a second variable copies the reference, not the object. scriptc does the same for objects, strings, arrays and boxes, and stores numbers and booleans directly in variables and fields. After LLVM's optimizer runs, many of those values live in processor registers rather than in memory at all, like `count` in the loop below.",
        },
        { kind: "code", title: "scriptc build --emit=asm: the counter.ts loop, `count` in %xmm0", code: counter.loop, language: "text" },
      ],
    },
    {
      id: "layout",
      title: "Fixed layout and lookup by name",
      blocks: [
        {
          kind: "text",
          text: "In JavaScript, `obj.count` looks up the property by its name, and an object can gain or lose properties at any time. V8 speeds this up by giving objects with the same properties in the same order a shared **hidden class** (V8 calls it a map), which records where each property is stored. Code optimized for one map can read the property directly, after checking that the object has that map.",
        },
        {
          kind: "text",
          text: "scriptc knows every field from the type, so it decides the **layout** of each object at compile time: which fields it has and where each one is, as an **offset** from the start of the object. A `Counter` is a struct of a reference count followed by `count`, and reading `this.count` reads the 8 bytes at offset 8. No name is looked up and nothing is checked.",
        },
        { kind: "code", title: "scriptc build --emit=llvm: the Counter struct", code: counter.llvm.struct, language: "text" },
        { kind: "text", text: "[Type checks in optimized code](/native/javascript#type-checks) shows V8's version: the map check before the read, and what happens when it fails." },
      ],
    },
    {
      id: "garbage-collection",
      title: "Freeing memory: garbage collection",
      blocks: [
        {
          kind: "text",
          text: "JavaScript code never frees memory. The engine's **garbage collector** does: from time to time it finds the objects that the program can no longer reach and frees them. While it works, the program pauses, for longer the more memory is still in use. V8 collects new objects separately and often, because most objects are only needed briefly.",
        },
        { kind: "code", title: "node --trace-gc, shapes.ts: each line is one collection", code: shapes.gc, language: "text" },
      ],
    },
    {
      id: "reference-counting",
      title: "Freeing memory: reference counting",
      blocks: [
        {
          kind: "text",
          text: "scriptc frees memory with **reference counting**. Each object stores a count of the references to it. Code that stores a reference increments the count (a **retain**), and code that drops a reference decrements it (a **release**). When the count reaches zero, nothing refers to the object any more and it is freed at once.",
        },
        { kind: "code", title: "scriptc build --emit=llvm: releasing a Counter (highlighted: the decrement)", code: counter.llvm.release, language: "text", highlight: linesFrom(counter.llvm.release, "sub i64 %rc, 1", 2) },
        {
          kind: "text",
          text: "This needs no pauses, but every retain and release is a little work, and those calls appear in much of scriptc's output (`scr_str_release` and similar). Reference counting also cannot free a **cycle**: two objects that refer to each other keep each other's count above zero even when nothing else refers to them. scriptc runs a **cycle collector** at defined points to find and free those.",
        },
      ],
    },
    {
      id: "calls",
      title: "Direct calls, dynamic calls and inlining",
      blocks: [
        {
          kind: "text",
          text: "A **direct call** jumps to a function the compiler knows. A **dynamic call** has to find the function first, while the program runs: by looking the method up by name, or by checking which class the object has. In scriptc, a call through an interface is a dynamic call of the second kind: a generated helper checks the value's class against each class that implements the interface.",
        },
        { kind: "code", title: "scriptc build --emit=llvm: the helper behind shape.area(), from types and operations", code: types.interfaces.llvm["%dyn.class.protocol.0"] ?? "", language: "text", foldAt: 20 },
        {
          kind: "text",
          text: "When the target of a call is known, the compiler can also **inline** it: copy the function's body into the caller and remove the call. LLVM inlined `increment` into the `counter.ts` loop, which is why the loop above contains only additions. A program that might replace methods at run time prevents this, because no call target is known any more ([writes with string keys and method calls](/native/how-it-works#slow-paths)).",
        },
      ],
    },
    {
      id: "generics",
      title: "Generic functions",
      blocks: [
        {
          kind: "text",
          text: "A generic function such as `total<T>(items: T[], measure: (item: T) => number)` works for any `T`. scriptc compiles a separate copy of the function for each type it is used with, a process called **specialization**. Each copy has fixed types inside, so it can use fixed layouts and direct calls. `total` is used only with `Shape`, so there is one copy, `total%0`, for the union `u0`:",
        },
        { kind: "code", title: "scriptc build --emit=ir: the functions in shapes.ts", code: shapes.ir.signatures, language: "text" },
      ],
    },
    {
      id: "speculation",
      title: "How V8 gets speed without types",
      blocks: [
        {
          kind: "text",
          text: "V8 has no types to go on, so it watches the program. It records which hidden classes and number types each operation sees, and when a function has run often enough it compiles it to machine code that assumes the same will keep happening: **speculative optimization**. Each assumption is checked when the code runs. When a check fails, V8 discards the optimized code and continues in its interpreter, a **deoptimization**, and may optimize the function again later with the new information.",
        },
        { kind: "text", text: "[How V8 runs JavaScript](/native/javascript) follows this with captured traces and V8's machine code." },
      ],
    },
    {
      id: "dynamic-values",
      title: "Dynamic values in scriptc",
      blocks: [
        {
          kind: "text",
          text: "When a type is `any` or `unknown`, scriptc cannot choose a layout. It stores a **dynamic value** instead: a value that carries its type with it, so the compiled code can check it at run time. Every use of a dynamic value goes through the runtime: property reads look up names, arithmetic checks the operands' types, and a `for…of` loop runs JavaScript's full iterator protocol.",
        },
        { kind: "code", title: "Functions the compiled total calls, with items: any[]", code: (types.any.calls.total ?? []).join("\n"), language: "text", foldAt: 12 },
        {
          kind: "text",
          text: `This is where native code is slowest compared with Node: the \`any\` loop takes ${types.any.native.ms.toFixed(1)} ms natively and ${types.any.node.ms.toFixed(1)} ms under Node, which compiles the same loop speculatively. [Types and operations](/native/types) measures each kind of value; [writing fast code](/native/performance) shows the changes that avoid dynamic values.`,
        },
      ],
    },
  ],
};
