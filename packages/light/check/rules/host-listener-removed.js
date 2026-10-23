import { defineRule } from "../define.js";

const RECEIVERS = "this|document|window|globalThis";
const LISTENER = new RegExp(`\\b(${RECEIVERS})\\.(add|remove)EventListener\\(\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`$]*)\`)?`, "g");

const STRING = /`(?:\\.|[^\\`])*`|"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*'/g;

/**
 * The same code with every string and template body blanked, character for
 * character, so a brace inside a literal cannot be mistaken for structure and
 * every offset still points where it did.
 * @param {string} code
 */
const blankStrings = (code) =>
  code.replace(STRING, (m) => m[0] + " ".repeat(m.length - 2) + m[m.length - 1]);

/**
 * The source range of the `connected()` that starts at `from`, by matching its
 * braces, or null if it is not a block.
 * @param {string} blanked
 * @param {number} from
 * @returns {[number, number] | null}
 */
const blockRange = (blanked, from) => {
  const open = blanked.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < blanked.length; i++)
    if (blanked[i] === "{") depth++;
    else if (blanked[i] === "}" && --depth === 0) return [from, i];

  return null;
};

export default defineRule({
  severity: "error",
  description: "a listener a component adds in connected() is removed in the same file",
  why: "connected() runs on every mount, and disconnectedCallback drains and clears the $own registry before it, so a listener added there without a matching removal is added again on every remount. An anonymous or freshly-bound handler cannot be removed afterwards even deliberately, which is how lc-float-panel, lc-bottom-sheet, anim-drag-panel and lc-droparea each accumulated a set of listeners per mount. Bind the handler to a name, add it, and $own the removal. A listener added in firstUpdated() is out of scope: that hook runs once per element, not once per mount",
  check(ctx) {
    for (const view of ctx.views()) {
      if (!view.isComponent) continue;
      const code = ctx.code(view.file);
      if (!code?.includes("addEventListener")) continue;
      const from = view.keyOffsets.connected;
      if (from === undefined) continue;
      const range = blockRange(blankStrings(code), from);
      if (!range) continue;

      /** @type {Map<string, number>} */
      const added = new Map();
      /** @type {Set<string>} */
      const removed = new Set();
      let unreadable = false;
      for (const match of code.matchAll(LISTENER)) {
        const type = match[3] ?? match[4] ?? match[5];
        const key = type === undefined ? null : `${match[1]}:${type}`;
        if (match[2] === "remove") {
          if (key) removed.add(key);
          continue;
        }
        if (match.index < range[0] || match.index >= range[1]) continue;
        if (!key) unreadable = true;
        else if (!added.has(key)) added.set(key, match.index);
      }
      if (unreadable) continue;

      for (const [key, offset] of added) {
        if (removed.has(key)) continue;
        const [receiver, type] = key.split(":");
        ctx.report({
          file: view.file,
          offset,
          message: `\`${receiver}.addEventListener("${type}", ...)\` in connected() has no matching \`${receiver}.removeEventListener("${type}", ...)\` in this file, so every remount adds another; name the handler and \`this.$own()\` its removal`,
        });
      }
    }
  },
});
