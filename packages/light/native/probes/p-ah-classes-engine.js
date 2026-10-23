/**
 * @file Probe AH: the utility-class engine natively. `createEngine` over the
 * default preset's scales compiles thirty classes, the ones a terminal styler
 * reads and the ones it ignores, and prints each class with its variants,
 * its media count, its order and its declarations, or `null`; then it times
 * two hundred distinct compiles and prints only the bucket they land in, so
 * node and the binary print the same lines.
 */
import { createEngine, parseClass } from "../../theme/classes/index.js";
import { buildTheme } from "../../theme/classes/scales.js";
import theme from "../../theme/themes/default.js";

const engine = createEngine({ theme: buildTheme(theme) });

const classes = ["flex", "flex-1", "flex-row", "flex-none", "p-4", "p-md", "px-2", "p-px", "gap-2", "text-primary", "text-muted", "text-dim", "bg-surface", "bg-canvas", "bg-transparent", "font-bold", "font-normal", "italic", "underline", "line-through", "opacity-50", "border", "border-0", "hidden", "overflow-y-auto", "items-center", "w-full", "w-10", "h-3", "text-sm", "truncate", "text-primary/50", "dark:text-primary", "md:flex-1", "hover:underline", "nope-xyz"];

for (const cls of classes) {
  const rule = engine.compile(cls);
  const parsed = parseClass(cls);
  const variants = parsed === null ? "-" : parsed.variants.join("+");
  if (rule === null) console.log(cls + " | " + variants + " | null");
  else console.log(cls + " | " + variants + " | medias " + String(rule.medias.length) + " | order " + String(rule.order) + " | " + rule.decls.join(";"));
}

const t0 = performance.now();
let compiled = 0;
for (let i = 0; i < 200; i++) if (engine.compile("p-" + String(i)) !== null) compiled++;
const ms = performance.now() - t0;
console.log("200 distinct compiles: " + String(compiled) + " rules, " + (ms < 50 ? "fast" : ms < 500 ? "slow" : "very slow"));
const t1 = performance.now();
for (let i = 0; i < 200; i++) engine.compile("p-" + String(i));
console.log("200 memoized compiles: " + (performance.now() - t1 < 5 ? "fast" : "slow"));
