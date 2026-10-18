/**
 * /native/types: how scriptc compiles common TypeScript types and operations,
 * one small program each, with the types it chose, the functions its hot code
 * calls, coverage, and the time under Node and native. The facts the words
 * state are checked by the capture (`TYPES` in scripts/capture-native.mjs).
 */
import captured from "./captures-types.js";

const { tools, examples } = captured;

/** @typedef {(typeof examples)[keyof typeof examples]} Example */

/** @param {number} ms */
const ms = (ms) => `${ms.toFixed(1)}\u00a0ms`;

/** @param {Example} example */
const ratio = (example) => example.native.ms / example.node.ms;

/** "3.2 times slower", "2.1 times faster", "about the same". @param {Example} example */
const compared = (example) => {
  const r = ratio(example);
  if (r >= 0.9 && r <= 1.1) return "about the same as Node";
  return r > 1 ? `${r.toFixed(1)} times slower than Node` : `${(1 / r).toFixed(1)} times faster than Node`;
};

/** The types scriptc chose, as one block of text. @param {Example} example */
const typesOf = (example) => [...example.unions.map((u) => `union ${u}`), ...example.records.map((r) => `record ${r}`), ...example.classes, ...example.signatures].join("\n");

/** The functions a compiled function calls, one per line. @param {Example} example @param {string} fn */
const callsOf = (example, fn) => (example.calls[fn] ?? []).join("\n");

/** The lines of the source that hold `text`, as a highlight. @param {Example} example @param {string[]} texts */
const linesWith = (example, ...texts) =>
  example.source
    .split("\n")
    .flatMap((line, index) => (texts.some((text) => line.includes(text)) ? [String(index + 1)] : []))
    .join(",");

/** The source, and the types scriptc chose for it, side by side. @param {Example} example @param {string[]} marks */
const sourceAndTypes = (example, ...marks) => ({
  kind: /** @type {const} */ ("compare"),
  items: [
    { kind: /** @type {const} */ ("code"), title: example.file, code: example.source.trimEnd(), language: "ts", highlight: linesWith(example, ...marks) },
    { kind: /** @type {const} */ ("code"), title: "scriptc build --emit=ir: the types (summary)", code: typesOf(example), language: "text" },
  ],
});

/** @param {Example} example @param {string} fn */
const calls = (example, fn) => ({ kind: /** @type {const} */ ("code"), title: `Functions the compiled ${fn} calls`, code: callsOf(example, fn), language: "text" });

/** @param {Example} example */
const timing = (example) => `Node takes ${ms(example.node.ms)} and the native executable ${ms(example.native.ms)}: ${compared(example)}.`;

/**
 * One section per example, in the order of the summary table.
 * @type {{ id: string, title: string, stored: string, example: Example, blocks: import("./topics.js").Block[] }[]}
 */
const SECTIONS = [
  {
    id: "numbers",
    title: "Numbers",
    stored: "64-bit floats, unboxed",
    example: examples.numbers,
    blocks: [
      { kind: "text", text: "A `number` is an `f64`, a 64-bit float, in scriptc's IR. Locals and `number[]` elements hold the value itself, with no box. `mean` reads each element as a double (`scr_arr_get_f64`)." },
      sourceAndTypes(examples.numbers, "function", "sum +=", "count++"),
      calls(examples.numbers, "mean"),
      { kind: "text", text: timing(examples.numbers) },
    ],
  },
  {
    id: "boolean-or-string",
    title: "boolean | string",
    stored: "a tagged union in a heap box",
    example: examples.union,
    blocks: [
      {
        kind: "text",
        text: "A union of types with different representations compiles to a tagged union, stored in a separate heap object: a box that holds a reference count, a tag saying which member type the value has, and the value. Each element pushed into `values` gets its own box (`scr_union_new_bool`, `scr_union_new_ref`). `typeof value === \"string\"` loads the tag from the box and compares it.",
      },
      sourceAndTypes(examples.union, "function weight", "typeof"),
      { kind: "code", title: "scriptc build --emit=llvm: weight", code: examples.union.llvm.weight ?? "", language: "text", foldAt: 16 },
      { kind: "text", text: timing(examples.union) },
    ],
  },
  {
    id: "optional",
    title: "Optional and nullable values",
    stored: "a pointer that can be null",
    example: examples.optional,
    blocks: [
      {
        kind: "text",
        text: "`nickname?: string` is the union `string | undefined`, and `manager: User | null` is `null | r0`. These unions need no box: the field holds a pointer, and a missing value is a null pointer or a sentinel pointer (`@sc_nullable_absent`). `user.nickname ?? user.name` compares the pointer and picks one of the two strings.",
      },
      sourceAndTypes(examples.optional, "nickname", "manager", "??"),
      { kind: "code", title: "scriptc build --emit=llvm: label", code: examples.optional.llvm.label ?? "", language: "text", foldAt: 16 },
      { kind: "text", text: `${timing(examples.optional)} Each call retains the string it returns and the caller releases it (\`scr_str_release\`).` },
    ],
  },
  {
    id: "string-literal-unions",
    title: "String literal unions",
    stored: "a string; switch on length and bytes",
    example: examples.literals,
    blocks: [
      {
        kind: "text",
        text: "`type Op = \"add\" | \"sub\" | \"mul\"` compiles to `string`. The `switch` does not call a string comparison: it switches on the string's length (`switch i64`), then on its characters read as one integer (`switch i24` for three characters). The string is retained and released on each call.",
      },
      sourceAndTypes(examples.literals, "type Op", "switch", "case"),
      { kind: "code", title: "scriptc build --emit=llvm: apply", code: examples.literals.llvm.apply ?? "", language: "text", foldAt: 24 },
      { kind: "text", text: timing(examples.literals) },
    ],
  },
  {
    id: "any",
    title: "any",
    stored: "a dynamic value, checked at run time",
    example: examples.any,
    blocks: [
      {
        kind: "text",
        text: "A value typed `any` is a `dyn` value, whose type is only known at run time. `for (const item of items)` over a `dyn` runs JavaScript's full iterator protocol: it creates an iterator object and calls its `next()` method for each element (`scr_dyn_iterator`, `scr_dyn_call`). `item.price` is a property lookup by name, and `*` and `+` go through the runtime's dynamic arithmetic (`scr_dyn_arithmetic`, `scr_dyn_add`).",
      },
      sourceAndTypes(examples.any, "any", "item.price"),
      calls(examples.any, "total"),
      { kind: "text", text: `${timing(examples.any)} The loop body is the same as in [object literals](#object-literals), where the types are declared.` },
    ],
  },
  {
    id: "unknown",
    title: "unknown with typeof checks",
    stored: "a dynamic value, checked at run time",
    example: examples.unknown,
    blocks: [
      {
        kind: "text",
        text: "`unknown` is also `dyn`. Each `typeof` check compiles to a check of the value's run-time type (`check string`, `check f64`), and `Array.isArray` asks the runtime (`scr_dyn_ref_is_array`). After the checks the value is still dynamic, so reading the array's `length` is a dynamic property read (`%dyn.class.property.0`).",
      },
      sourceAndTypes(examples.unknown, "unknown", "typeof", "Array.isArray"),
      calls(examples.unknown, "size"),
      { kind: "text", text: timing(examples.unknown) },
    ],
  },
  {
    id: "object-literals",
    title: "Object literals",
    stored: "a struct with fixed field offsets",
    example: examples.records,
    blocks: [
      {
        kind: "text",
        text: "An object type such as `{ x: number; y: number }` compiles to a record: a struct with its fields at fixed offsets (`r0 = { x: f64, y: f64 }`). Reading `a.x` is a load from that offset. The non-null assertion in `points[i - 1]!` compiles to a check that throws if the element is missing (`scr_throw_node_coded`).",
      },
      sourceAndTypes(examples.records, "interface Point", "a.x"),
      calls(examples.records, "distance"),
      { kind: "text", text: timing(examples.records) },
    ],
  },
  {
    id: "classes",
    title: "Classes",
    stored: "a struct; methods are direct calls",
    example: examples.classes,
    blocks: [
      {
        kind: "text",
        text: "A class compiles to a struct with its fields after the reference count (`class Vector { x: f64, y: f64 }`), and its methods to functions that take the instance as their first argument. `add` allocates a new `Vector` on each call (`new Vector`). The `length` getter calls `Math.hypot`, which builds a temporary array of its arguments (`scr_arr_new`, `scr_math_hypot_arr`).",
      },
      sourceAndTypes(examples.classes, "class Vector", "add(", "new Vector"),
      calls(examples.classes, "%Vector.add"),
      { kind: "text", text: timing(examples.classes) },
    ],
  },
  {
    id: "interfaces",
    title: "Interfaces implemented by classes",
    stored: "a dynamic reference; calls check the class",
    example: examples.interfaces,
    blocks: [
      {
        kind: "text",
        text: "When class instances are used through an interface, scriptc stores them as checked dynamic references (`scr_dyn_new_typed_ref_observed`) and gives each class a property bag (`%dynProperties`). A call `shape.area()` goes to a generated helper (`%dyn.class.protocol.0`) that compares the value's class with each class implementing `Shape`, and calls that class's `area` directly.",
      },
      sourceAndTypes(examples.interfaces, "interface Shape", "implements", "shape.area()"),
      { kind: "code", title: "scriptc build --emit=llvm: %dyn.class.protocol.0", code: examples.interfaces.llvm["%dyn.class.protocol.0"] ?? "", language: "text", foldAt: 24 },
      { kind: "text", text: timing(examples.interfaces) },
    ],
  },
  {
    id: "record-dictionaries",
    title: "Record<string, T> with dynamic keys",
    stored: "a string-keyed hash map",
    example: examples.dictionary,
    blocks: [
      {
        kind: "text",
        text: "A `Record<string, number>` written with arbitrary keys compiles to a string-keyed hash map (`scr_map_get_str_f64`, `scr_map_set_str_f64`). `counts[word] ?? 0` first produces a `number | undefined`, which is boxed (`scr_union_new_f64`) and released on every access.",
      },
      sourceAndTypes(examples.dictionary, "Record<string, number>", "counts[word]"),
      calls(examples.dictionary, "countWords"),
      { kind: "text", text: timing(examples.dictionary) },
    ],
  },
  {
    id: "maps",
    title: "Map",
    stored: "a string-keyed hash map",
    example: examples.map,
    blocks: [
      {
        kind: "text",
        text: "`Map<string, number>` uses the same kind of hash map. `counts.get(word) ?? 0` compiles to a single entry lookup (`map_entry_str`) without the intermediate box, so the loop calls fewer runtime functions than the `Record` version.",
      },
      sourceAndTypes(examples.map, "new Map", "counts.get", "counts.set"),
      calls(examples.map, "countWords"),
      { kind: "text", text: `${timing(examples.map)} The \`Record\` version of the same function takes ${ms(examples.dictionary.native.ms)} natively and ${ms(examples.dictionary.node.ms)} under Node.` },
    ],
  },
  {
    id: "keyof",
    title: "Keys of a known type",
    stored: "a string compared with each field name",
    example: examples.keyof,
    blocks: [
      {
        kind: "text",
        text: "With `key: keyof Settings`, `settings[key]` compiles to a comparison of the key with each field name in turn (one `streq_…` call per field),, and a fallback for a key that matches none (`scr_record_key_miss`).",
      },
      sourceAndTypes(examples.keyof, "keyof", "settings[key]"),
      calls(examples.keyof, "bump"),
      { kind: "text", text: timing(examples.keyof) },
    ],
  },
  {
    id: "properties-added-through-a-cast",
    title: "Properties added through a cast",
    stored: "a dynamic copy of the record",
    example: examples.expando,
    blocks: [
      {
        kind: "text",
        text: "`item as unknown as Record<string, unknown>` converts the record to a dynamic value, and for a record this conversion makes a copy (`scr_dyn_new_typed_ref_observed`, `scr_dyn_typed_ref_bind_record`). The new property is written to the copy, so the original object never has it:",
      },
      sourceAndTypes(examples.expando, "as unknown as"),
      {
        kind: "compare",
        items: [
          { kind: "code", title: "node", code: examples.expando.node.stdout.trimEnd(), language: "text" },
          { kind: "code", title: `native (scriptc): exit ${examples.expando.native.status}`, code: examples.expando.native.stdout.trimEnd(), language: "text" },
        ],
      },
      {
        kind: "note",
        variant: "warning",
        title: "Different output",
        text: "scriptc's documentation says that converting a record to a dynamic value can copy it ([untyped values](https://scriptc.dev/docs/limitations)), but coverage reports this program as fully static. A class keeps its identity through the same cast; so does a record that is typed as a `Record` from the start.",
      },
      { kind: "text", text: timing(examples.expando) },
    ],
  },
  {
    id: "arrays",
    title: "Arrays",
    stored: "unboxed numbers, or one box per union element",
    example: examples.arrays,
    blocks: [
      {
        kind: "text",
        text: "`number[]` stores doubles directly and reads them with `scr_arr_get_f64`. `(number | string)[]` stores the union `f64 | string`, with one box per element, created when the element is pushed.",
      },
      sourceAndTypes(examples.arrays, "number[]", "(number | string)[]"),
      calls(examples.arrays, "sum"),
      { kind: "text", text: timing(examples.arrays) },
    ],
  },
  {
    id: "closures",
    title: "Closures and array callbacks",
    stored: "a closure with a boxed captured variable",
    example: examples.closures,
    blocks: [
      {
        kind: "text",
        text: "`makeCounter` returns a closure that captures `count` and assigns to it. scriptc stores `count` in a heap box (`scr_box_new`) that the closure holds (`scr_closure_new`). The `filter`, `map` and `reduce` chain compiles to one generated function (`%arr.fused.0`), with the callbacks as part of it.",
      },
      sourceAndTypes(examples.closures, "makeCounter", ".filter", ".map", ".reduce"),
      calls(examples.closures, "makeCounter"),
      { kind: "text", text: timing(examples.closures) },
    ],
  },
  {
    id: "strings",
    title: "Building strings",
    stored: "a reference-counted string, appended in place",
    example: examples.strings,
    blocks: [
      {
        kind: "text",
        text: "`out += …` hands the current string to the concatenation instead of keeping a copy (`scr_str_concat_mixed_move`). When nothing else refers to the string, the runtime appends to it in place.",
      },
      sourceAndTypes(examples.strings, "out +="),
      calls(examples.strings, "render"),
      { kind: "text", text: timing(examples.strings) },
    ],
  },
  {
    id: "json",
    title: "JSON.parse with a type",
    stored: "a parser generated for the record",
    example: examples.json,
    blocks: [
      {
        kind: "text",
        text: "`JSON.parse(json) as Order` compiles to a parser generated for the `Order` record (`JSON.parse as record:r1`). It parses the text directly into the record type and checks each field's type as it goes.",
      },
      sourceAndTypes(examples.json, "JSON.parse", "as Order"),
      calls(examples.json, "quantity"),
      { kind: "text", text: timing(examples.json) },
    ],
  },
  {
    id: "exceptions",
    title: "Exceptions",
    stored: "an Error object, thrown and caught",
    example: examples.exceptions,
    blocks: [
      {
        kind: "text",
        text: "`throw new Error(…)` creates an `Error` object (`scr_error_new_options`) and throws it (`scr_throw_obj`). In this program one input in ten throws. Under Node, creating each `Error` also records the call stack.",
      },
      sourceAndTypes(examples.exceptions, "throw", "try", "catch"),
      calls(examples.exceptions, "parsePositive"),
      { kind: "text", text: timing(examples.exceptions) },
    ],
  },
  {
    id: "async",
    title: "async and await",
    stored: "fiberless when awaited directly",
    example: examples.async,
    blocks: [
      {
        kind: "text",
        text: "scriptc compiles `load` in two forms: `await load`, used where a caller awaits it directly, and `fiberless load`, which returns a promise. `load` contains no `await`, and neither form runs on a fiber. `main`, which awaits in a loop, runs on a fiber (`spawn main`, `scr_async_spawn`).",
      },
      sourceAndTypes(examples.async, "async function", "await"),
      calls(examples.async, "fiberless load"),
      { kind: "text", text: timing(examples.async) },
    ],
  },
];

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "Types and operations",
  lede: "How scriptc compiles common TypeScript types and operations, and how each one performs compared with Node. Each example is a small program that runs one operation in a loop.",
  sections: [
    {
      id: "summary",
      title: "Summary",
      blocks: [
        {
          kind: "text",
          text: `Each program times its own loop and prints the milliseconds; the table shows the fastest of five runs under Node ${tools.node} and as a scriptc ${tools.scriptc} executable, on ${tools.platform} (${tools.cpus} cores, load average ${tools.load} when the capture started). In the IR summaries, \`f64\` is a number, \`dyn\` a value whose type is checked at run time, \`u0\` a union and \`r0\` a record.`,
        },
        {
          kind: "table",
          columns: [
            { name: "example", label: "Example" },
            { name: "stored", label: "How scriptc stores it" },
            { name: "node", label: "Node" },
            { name: "native", label: "Native" },
            { name: "ratio", label: "Native ÷ Node" },
          ],
          rows: SECTIONS.map((section) => ({
            example: section.title,
            stored: section.stored,
            node: ms(section.example.node.ms),
            native: ms(section.example.native.ms),
            ratio: `${ratio(section.example).toFixed(2)}×${section.example.same ? "" : " (different output)"}`,
          })),
        },
        { kind: "text", text: "[Writing fast code](/native/performance) turns these results into changes measured under both engines." },
      ],
    },
    ...SECTIONS.map(({ id, title, blocks }) => ({ id, title, blocks })),
  ],
};
