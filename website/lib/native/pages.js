/**
 * The /native section's pages, in reading order and in two groups: light's
 * native build (how it works, how to use it) and the background the
 * explanations rely on. What the shell's nav column lists inside the section,
 * the pager under each page, and what the palette searches. A topic page's
 * words are its own module under `lib/native/`.
 */

const NATIVE_PATH = "/native";

/** @type {{ id: string, label: string }[]} */
export const NATIVE_GROUPS = [
  { id: "native", label: "Native" },
  { id: "background", label: "Background" },
];

/** `nav` is the shorter label the nav column shows where `label` would not fit. @type {{ topic: string, group: string, label: string, nav?: string, href: string, hint: string }[]} */
export const NATIVE_PAGES = [
  { topic: "", group: "native", label: "Introduction", href: NATIVE_PATH, hint: "Light compiled with scriptc, and what these pages cover" },
  { topic: "how-it-works", group: "native", label: "How it works", href: `${NATIVE_PATH}/how-it-works`, hint: "What compiles, the coverage check, which scriptc, the benchmark" },
  { topic: "how-to-use", group: "native", label: "How to use", href: `${NATIVE_PATH}/how-to-use`, hint: "Setting up scriptc, the commands, native tests, rules for native code" },
  { topic: "issues", group: "native", label: "Open issues", href: `${NATIVE_PATH}/issues`, hint: "Known gaps in light's native build and in scriptc" },
  { topic: "concepts", group: "background", label: "Concepts", href: `${NATIVE_PATH}/concepts`, hint: "Boxes, the heap, layout, garbage collection, reference counting" },
  { topic: "comparison", group: "background", label: "Browser, Node and native", nav: "Comparison", href: `${NATIVE_PATH}/comparison`, hint: "One program in a browser, in Node and native (scriptc)" },
  { topic: "javascript", group: "background", label: "How V8 runs JavaScript", nav: "How V8 works", href: `${NATIVE_PATH}/javascript`, hint: "Bytecode, type feedback, optimizing compilers, deoptimization" },
  { topic: "scriptc", group: "background", label: "How scriptc compiles TypeScript", nav: "How scriptc works", href: `${NATIVE_PATH}/scriptc`, hint: "Typed IR, data layout, reference counting, coverage" },
  { topic: "types", group: "background", label: "Types and operations", nav: "Types", href: `${NATIVE_PATH}/types`, hint: "How common types and operations compile, and their speed" },
  { topic: "performance", group: "background", label: "Writing fast code", href: `${NATIVE_PATH}/performance`, hint: "Changes measured under V8 and scriptc" },
  { topic: "tsc-ts", group: "background", label: "tsc-ts", href: `${NATIVE_PATH}/tsc-ts`, hint: "The TypeScript 7 compiler, ported to TypeScript and compiled with scriptc" },
];

/** @param {string} path */
export const inNative = (path) => path === NATIVE_PATH || path.startsWith(`${NATIVE_PATH}/`);

/**
 * The pages before and after a topic, as the pager's links.
 * @param {string} topic
 */
export const nativeNeighbours = (topic) => {
  const at = NATIVE_PAGES.findIndex((page) => page.topic === topic);
  /** @param {(typeof NATIVE_PAGES)[number] | undefined} page */
  const link = (page) => (page ? { label: page.label, href: page.href, hint: NATIVE_GROUPS.find((group) => group.id === page.group)?.label ?? "Native" } : null);
  return { previous: at > 0 ? link(NATIVE_PAGES[at - 1]) : null, next: at >= 0 ? link(NATIVE_PAGES[at + 1]) : null };
};
