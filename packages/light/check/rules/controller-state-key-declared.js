import { defineRule } from "../define.js";
import { collectMixinNames } from "../parse/instance-surface.js";

const SUBSCRIBE = /(?<![\w.$])(?:[\w$]+\.)?(\w+)\.\$state\.subscribe\(\s*["']([\w.-]+)["']/g;
const SYNC = /\bsync:\s*["'](\w+)["']/g;

/**
 * Whether a controller's `props` block spreads another object in, which
 * makes its declared surface unreadable here; such a controller is skipped.
 * @param {string} source
 * @param {number | undefined} offset
 */
const spreadsProperties = (source, offset) => {
  if (offset === undefined) return false;
  const open = source.indexOf("{", offset);
  if (open === -1) return false;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(open, i).includes("...");
  }
  return false;
};

export default defineRule({
  severity: "error",
  description: "a sync: \"<controller>\" binding and a <controller>.$state.subscribe(\"<key>\") (reached through one qualifier, `app.<controller>`, or a local of that name) name a property that controller declares",
  why: "store.subscribe accepts any key and a binding to an undeclared one parks silently, so a property that moved to another controller leaves every view bound to the old name stale with no error; the declared surface, fragments included, is the contract",
  check(ctx) {
    const adapters = ctx.syncAdapters();
    /** @type {Map<string, Set<string>>} */
    const declared = new Map();
    for (const c of [...ctx.controllers(), ...ctx.dependencyControllers()]) {
      if (!c.name || spreadsProperties(c.source, c.keyOffsets.props)) continue;
      const names = new Set(c.propertyNames.map((p) => p.name));
      collectMixinNames(ctx.read, c.file, c.mixins, names);
      declared.set(c.name, names);
    }
    if (!declared.size) return;
    for (const file of ctx.files()) {
      if (!file.endsWith(".js") || file.endsWith(".test.js") || file.startsWith("tests/")) continue;
      const source = ctx.read(file) || "";
      for (const match of source.matchAll(SUBSCRIBE)) {
        const names = declared.get(match[1]);
        if (!names || names.has(match[2])) continue;
        ctx.report({ file, offset: match.index, message: `"${match[1]}" declares no property "${match[2]}", so this subscription never fires` });
      }
      for (const match of source.matchAll(SYNC)) {
        const target = match[1];
        if (adapters.has(target)) continue;
        const names = declared.get(target);
        if (!names) continue;
        const lineStart = source.lastIndexOf("\n", match.index) + 1;
        const lineEnd = source.indexOf("\n", match.index);
        const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
        const key = line.match(/\bkey:\s*["']([\w.-]+)["']/)?.[1] ?? line.match(/^\s*(\w+):/)?.[1];
        if (!key || names.has(key)) continue;
        ctx.report({ file, offset: match.index, message: `sync: "${target}" binds "${key}", which "${target}" does not declare, so the value never arrives` });
      }
    }
    for (const c of ctx.controllers())
      for (const entry of c.syncEntries) {
        const names = entry.target && !adapters.has(entry.target) ? declared.get(entry.target) : null;
        const key = entry.key ?? entry.prop;
        if (!names || names.has(key)) continue;
        ctx.report({ file: c.file, offset: entry.targetOffset, message: `sync: "${entry.target}" binds "${key}", which "${entry.target}" does not declare, so the value never arrives` });
      }
  },
});
