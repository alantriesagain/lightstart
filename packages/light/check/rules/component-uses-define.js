import { defineRule } from "../define.js";

const BARE_EXPORT = /^export default \{/m;
const NAMED_EXPORT = /^export default ([A-Za-z_$][\w$]*);/m;
const DECLARES_TAG = /^\s+tag:\s*["'`]/m;

/** @param {string} source @returns {number | null} the index of the bare literal a default export names, if any */
const bareLiteralIndex = (source) => {
  const direct = BARE_EXPORT.exec(source);
  if (direct) return direct.index;
  const named = NAMED_EXPORT.exec(source);
  if (!named) return null;
  const declared = new RegExp(`^(?:const|let) ${named[1]} = \\{`, "m").exec(source);
  return declared ? declared.index : null;
};

export default defineRule({
  severity: "error",
  description: "a component definition goes through defineComponent",
  why: "a bare `export default { tag, props, render }` types `this` as the literal itself, so every property the props block declares reads as missing and the file is unchecked in practice; defineComponent(def) is the same object at runtime and the one place mixins, HMR and plugin hooks attach",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!file.endsWith(".js") || file.endsWith(".test.js")) continue;
      const source = ctx.read(file);
      if (!source) continue;
      const index = bareLiteralIndex(source);
      if (index === null) continue;
      const close = source.indexOf("\n};", index);
      const literal = source.slice(index, close === -1 ? undefined : close);
      if (!DECLARES_TAG.test(literal)) continue;
      const line = source.slice(0, index).split("\n").length;
      ctx.report({ file, line, col: 1, message: "the component is a bare object literal; declare it with defineComponent({ ... }) from @bootstrapp/light so this is typed from its props" });
    }
  },
});
