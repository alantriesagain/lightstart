import { defineRule } from "../define.js";

const DECLARED_TAG = /^\s*tag:\s*["'`]([^"'`]+)/m;

export default defineRule({
  severity: "error",
  description: "a component listed in bootstrapp.components declares the tag it is listed under",
  why: "the loader takes the tag from the map, so a definition without one still registers and every rule that asks `is this a component` answers no: the file is skipped by the whole ruleset. Ten lc components sat unchecked that way, two of them bare object literals that component-uses-define could not see. A declared tag is also what tells a reader of the file which element it is. Under the folder form (`{ prefix: \"views/\" }`) the tag comes from the path, and only a file that declares a different one is reported: a helper or a render-function module under views/ declares none and is not a component. That form hid a real break, an agent view declaring <ai-diff> while its path said <ai-diff-viewer>, so the tag resolved to a file that does not exist and the element never upgraded",
  appliesTo: { when: (ctx) => !!ctx.pkg?.bootstrapp?.components },
  check(ctx) {
    const components = ctx.pkg?.bootstrapp?.components;
    if (!components || typeof components !== "object") return;
    const files = new Set(ctx.files());
    /** @type {Map<string, Set<string>>} */
    const byFolder = new Map();
    for (const [prefix, entries] of Object.entries(components)) {
      if (typeof entries !== "string") continue;
      const folder = entries.replace(/^\.?\//, "");
      for (const file of files) {
        if (!file.startsWith(folder) || !file.endsWith(".js") || file.includes(".test.")) continue;
        const tag = `${prefix}-${file.slice(folder.length).replace(/\.js$/, "").replace(/\//g, "-")}`;
        const tags = byFolder.get(file) ?? new Set();
        tags.add(tag);
        byFolder.set(file, tags);
      }
    }
    for (const [file, tags] of byFolder) {
      const declared = DECLARED_TAG.exec(ctx.code(file) || "")?.[1];
      if (!declared || tags.has(declared)) continue;
      const names = [...tags].map((t) => `<${t}>`).join(" or ");
      ctx.report({
        file,
        line: 1,
        col: 1,
        message: `this path resolves the tag ${names} but the file declares tag: "${declared}"; the loader fetches the path the tag names, so <${declared}> loads nothing and the element never upgrades`,
      });
    }

    for (const [prefix, entries] of Object.entries(components)) {
      if (!entries || typeof entries !== "object") continue;
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value !== "string") continue;
        const file = value.replace(/^\.?\//, "");
        if (!files.has(file)) continue;
        const expected = `${prefix}-${key}`;
        const declared = DECLARED_TAG.exec(ctx.code(file) || "");
        if (declared?.[1] === expected) continue;
        ctx.report({
          file,
          line: 1,
          col: 1,
          message: declared
            ? `listed as <${expected}> but declares tag: "${declared[1]}"; the map wins at runtime, so the declaration is a lie a reader will believe`
            : `listed as <${expected}> but declares no tag:, so every rule guarded on "is this a component" skips this file; add tag: "${expected}"`,
        });
      }
    }
  },
});
