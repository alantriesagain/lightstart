/**
 * /native/performance: changes to the same code, each measured under Node and
 * native (scriptc): which ones make the code faster under both engines, under
 * one, or under neither. The numbers are `captures-pairs.js`; which engine a
 * change helps is computed from them.
 */
import captured from "./captures-pairs.js";

const { tools, pairs, deleteProbe, stacklessThrow } = captured;

/** @typedef {(typeof pairs)[keyof typeof pairs]} Pair */

/** A change counts as faster or slower at 1.25 times or more either way. */
const THRESHOLD = 1.25;

/** @param {number} ms */
const ms = (ms) => `${ms.toFixed(1)}\u00a0ms`;

/** @param {number} before @param {number} after @returns {"faster" | "slower" | "same"} */
const effect = (before, after) => (before / after >= THRESHOLD ? "faster" : after / before >= THRESHOLD ? "slower" : "same");

/** "4.2 times faster", "1.6 times slower", "no measurable change". @param {number} before @param {number} after */
const change = (before, after) => {
  const e = effect(before, after);
  if (e === "same") return "no clear change";
  return e === "faster" ? `${(before / after).toFixed(1)} times faster` : `${(after / before).toFixed(1)} times slower`;
};

/** @param {Pair} pair */
const effects = (pair) => ({ node: effect(pair.slow.node, pair.fast.node), native: effect(pair.slow.native, pair.fast.native) });

/** Which engine the change makes faster. @param {Pair} pair */
const helps = (pair) => {
  const { node, native } = effects(pair);
  if (node === "faster" && native === "faster") return "both";
  if (node === "faster") return native === "slower" ? "Node only (slower native)" : "Node only";
  if (native === "faster") return node === "slower" ? "native only (slower under Node)" : "native only";
  if (node === "slower" || native === "slower") return "neither (slower under at least one)";
  return "neither";
};

/** @param {Pair} pair */
const numbers = (pair) =>
  `Under Node: ${ms(pair.slow.node)} before, ${ms(pair.fast.node)} after (${change(pair.slow.node, pair.fast.node)}). Native (scriptc): ${ms(pair.slow.native)} before, ${ms(pair.fast.native)} after (${change(pair.slow.native, pair.fast.native)}).`;

/**
 * The 1-based numbers of the lines of `code` that `other` does not have, as
 * an `lc-code-block` highlight: the lines the change touched.
 * @param {string} code @param {string} other
 */
const changedLines = (code, other) => {
  const theirs = new Set(other.split("\n").map((line) => line.trim()));
  return code
    .split("\n")
    .flatMap((line, index) => (line.trim() && !theirs.has(line.trim()) ? [String(index + 1)] : []))
    .join(",");
};

/** The two versions side by side, the changed lines highlighted. @param {string} id @param {Pair} pair */
const versions = (id, pair) => {
  const [slow, fast] = [pair.slow.source.trimEnd(), pair.fast.source.trimEnd()];
  return {
    kind: /** @type {const} */ ("compare"),
    items: [
      { kind: /** @type {const} */ ("code"), title: `${id}-slow.ts: before`, code: slow, language: "ts", highlight: changedLines(slow, fast) },
      { kind: /** @type {const} */ ("code"), title: `${id}-fast.ts: after`, code: fast, language: "ts", highlight: changedLines(fast, slow) },
    ],
  };
};

/**
 * One section per change. `node` and `native` explain each engine's result.
 * @type {{ id: string, pair: keyof typeof pairs, title: string, change: string, node?: string, native: string }[]}
 */
const CHANGES = [
  {
    id: "declared-types",
    pair: "any",
    title: "Declaring types instead of any",
    change: "The same loop over items, with `items: any[]` before and an `Item` interface after.",
    node: "The types are removed before V8 runs the code, so both versions are the same JavaScript.",
    native: "With `any`, the loop runs the dynamic iterator protocol and every property read and arithmetic operation is dynamic ([any](/native/types#any)). With the interface, the items are records and the arithmetic is on `f64` values.",
  },
  {
    id: "unions",
    pair: "unknown",
    title: "Union types instead of unknown",
    change: "`size(value: unknown)` with `typeof` and `Array.isArray` checks before, and `size(value: string | number | number[])` after.",
    node: "The types are removed, so the two versions differ only in the `Array.isArray` call.",
    native: "With `unknown`, each check examines a dynamic value and `.length` is a dynamic property read ([unknown](/native/types#unknown)). With the union, each value is a tagged union: the checks read its tag, and `.length` reads the array directly.",
  },
  {
    id: "maps",
    pair: "dictionary",
    title: "Map instead of a Record for dynamic keys",
    change: "Counting words in a `Record<string, number>` before, and in a `Map<string, number>` after.",
    native: "Both are string-keyed hash maps, but `counts[word] ?? 0` boxes a `number | undefined` on every access and `counts.get(word) ?? 0` does not ([Map](/native/types#maps)).",
  },
  {
    id: "string-keyed-writes",
    pair: "dispatch",
    title: "Keeping writes with string keys off objects",
    change: "A `save(settings, key, value)` helper that writes into a `Record<string, unknown>` before, and into a `Map` after. The loop that is timed only calls `counter.increment(2)`.",
    node: "V8 already checks the object's map on each method call, so the helper changes nothing.",
    native: "A write whose key can be any string could replace a method, so with the `Record` helper anywhere in the program every method call is dynamic ([writes with string keys](/native/how-it-works#slow-paths)). Coverage reports the write as SC7001.",
  },
  {
    id: "results-instead-of-exceptions",
    pair: "exceptions",
    title: "Returning a value instead of throwing",
    change: "One input in ten is invalid. Before, `parsePositive` throws and the caller catches; after, it returns `undefined` and the caller checks.",
    node: `Creating each \`Error\` records the call stack. With stack traces turned off (\`node --stack-trace-limit=0\`), the throwing version takes ${ms(stacklessThrow)} instead of ${ms(pairs.exceptions.slow.node)}.`,
    native: "Throwing creates an `Error` object and unwinds to the `catch`, which costs more than returning, though much less than under Node.",
  },
  {
    id: "in-place-updates",
    pair: "allocation",
    title: "Updating objects in place",
    change: "`sum = sum.add(step)`, which creates a new `Vector` each time, before; `sum.addInPlace(step)` after.",
    node: "V8 allocates short-lived objects in its young generation, where they are cheap to create and to collect ([garbage collection](/native/javascript#garbage-collection)).",
    native: "Each `new Vector` calls the allocator, and the previous `Vector` is freed when its reference count reaches zero. Updating in place does neither.",
  },
  {
    id: "consistent-object-shapes",
    pair: "shapes",
    title: "Creating objects with the same properties in the same order",
    change: "Six ways to create a `Point` (properties in different orders, some optional properties present) before; one way after.",
    node: "V8 gives each combination of properties and order its own hidden class (map). The property read in `sumX` then sees six maps instead of one, and V8's code for it has to handle all of them.",
    native: "`Point` is one record type however the object was created, so `point.x` is the same load in both versions.",
  },
  {
    id: "assigning-undefined",
    pair: "delete",
    title: "Assigning undefined instead of delete",
    change: "`delete entry.label` before, and `entry.label = undefined` after.",
    node: `After \`delete\`, V8 switches the object to a slower dictionary representation for its properties. V8's own check (\`%HasFastProperties\`) reports fast properties ${deleteProbe.before ? "before" : "not even before"} the \`delete\`, ${deleteProbe.afterDelete ? "fast" : "slow"} properties after it, and ${deleteProbe.afterAssign ? "fast" : "slow"} properties after assigning \`undefined\` instead.`,
    native: "An optional field is a pointer that can be absent, and `delete` compiles to the same store as assigning `undefined`.",
  },
  {
    id: "number-constants",
    pair: "literals",
    title: "Number constants instead of string literals",
    change: "`type Op = \"add\" | \"sub\" | \"mul\"` before, and number constants `ADD`, `SUB`, `MUL` after.",
    native: "The string version switches on the string's length and bytes and retains and releases the string ([string literal unions](/native/types#string-literal-unions)); the number version compares numbers.",
  },
  {
    id: "classes-behind-interfaces",
    pair: "interfaces",
    title: "A union of records instead of classes behind an interface",
    change: "`Circle` and `Square` classes behind a `Shape` interface before, and a union of two records with a `kind` field after.",
    native: "`shape.kind === \"circle\"` compiles to a string comparison, with a retain and release of the string, on every call. The class version compares the value's class ([interfaces](/native/types#interfaces)).",
  },
  {
    id: "string-building",
    pair: "strings",
    title: "Array join instead of +=",
    change: "`out += …` in a loop before, and pushing the parts to an array and calling `join(\"\")` after.",
    native: "`+=` appends to the string in place when nothing else refers to it ([building strings](/native/types#strings)). `join` builds an array of parts first.",
  },
];

const rows = CHANGES.map((entry) => ({ entry, pair: pairs[entry.pair] }));

/** The changes a classification covers, as a sentence's list of links. @param {(entry: (typeof rows)[number]) => boolean} test */
const listed = (test) => {
  const found = rows.filter(test).map(({ entry }) => `[${entry.title.charAt(0).toLowerCase()}${entry.title.slice(1)}](#${entry.id})`);
  return found.length ? found.join("; ") : "none";
};

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "Writing fast code for V8 and scriptc",
  lede: "Each change on this page rewrites the same computation in two ways. Both versions print the same output, so the difference in time is the effect of the change, measured under Node and as a scriptc executable.",
  sections: [
    {
      id: "results",
      title: "Results",
      blocks: [
        {
          kind: "text",
          text: `Each program times its own loop; the numbers are the fastest of seven runs under Node ${tools.node} and as a scriptc ${tools.scriptc} executable, on ${tools.platform} (${tools.cpus} cores, load average ${tools.load} when the capture started). The runs of the two versions alternate, so both see the same load. A change counts as faster or slower when the time changes by a factor of ${THRESHOLD} or more.`,
        },
        {
          kind: "table",
          columns: [
            { name: "change", label: "Change" },
            { name: "node", label: "Node, before → after" },
            { name: "native", label: "Native, before → after" },
            { name: "helps", label: "Faster under" },
          ],
          rows: rows.map(({ entry, pair }) => ({
            change: entry.title,
            node: `${ms(pair.slow.node)} → ${ms(pair.fast.node)}`,
            native: `${ms(pair.slow.native)} → ${ms(pair.fast.native)}`,
            helps: helps(pair),
          })),
        },
        {
          kind: "list",
          items: [
            `Faster under both engines: ${listed(({ pair }) => helps(pair) === "both")}.`,
            `Faster native only: ${listed(({ pair }) => helps(pair).startsWith("native only"))}.`,
            `Faster under Node only: ${listed(({ pair }) => helps(pair).startsWith("Node only"))}.`,
            `Faster under neither: ${listed(({ pair }) => helps(pair).startsWith("neither"))}.`,
          ],
        },
      ],
    },
    ...rows.map(({ entry, pair }) => ({
      id: entry.id,
      title: entry.title,
      blocks: /** @type {import("./topics.js").Block[]} */ ([
        { kind: "text", text: entry.change },
        versions(entry.pair, pair),
        { kind: "text", text: numbers(pair) },
        {
          kind: "list",
          items: [...(entry.node ? [`Node: ${entry.node}`] : []), `Native (scriptc): ${entry.native}`],
        },
      ]),
    })),
  ],
};
