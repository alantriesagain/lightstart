import { defineRule } from "../define.js";

const DECL = /^export\s+(?:interface|type)\s+([A-Za-z_$][\w$]*)/gm;

export default defineRule({
  severity: "error",
  description: "a type name is declared once per file; a second `export interface` of the same name merges instead of failing",
  why: "TypeScript merges duplicate interface declarations rather than rejecting them, so two copies that drifted typecheck while the compiler holds the union of both and can reject neither shape. `VpsCredentials` was declared twice with different fields, and `sessionFor(credentials)` is the seam every vps route goes through",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!file.endsWith(".ts") || file.endsWith(".d.ts") || /\.test\.ts$/.test(file)) continue;
      const source = ctx.code(file);
      if (!source) continue;
      /** @type {Map<string, number[]>} */
      const seen = new Map();
      DECL.lastIndex = 0;
      /** @type {RegExpExecArray | null} */
      let match;
      while ((match = DECL.exec(source)) !== null) {
        const name = /** @type {string} */ (match[1]);
        seen.set(name, [...(seen.get(name) ?? []), match.index]);
      }
      for (const [name, offsets] of seen) {
        if (offsets.length < 2) continue;
        for (const offset of offsets.slice(1))
          ctx.report({
            file,
            offset,
            message: `${name} is already declared in this file; a second declaration merges into a union of both shapes rather than failing. Keep one, or give the other shape its own name`,
          });
      }
    }
  },
});
