import { defineRule } from "../define.js";

const SYNC_TARGET = /\bsync:\s*["']([\w-]+)["']/g;

export default defineRule({
  severity: "error",
  description: "a sync: \"<name>\" string must name a sync adapter the host or the project registers, or a controller, or it never binds",
  why: "the binding queues a name nobody registers and never complains, so a typo leaves the property a plain local value forever. A package that hands its modules to importers (`exports` or `main`) is skipped: the app that loads it registers the names it binds",
  appliesTo: { when: (ctx) => !ctx.pkg.exports && !ctx.pkg.main },
  check(ctx) {
    const adapters = ctx.syncAdapters();
    const controllers = new Set();
    for (const c of [...ctx.controllers(), ...ctx.dependencyControllers()]) if (c.name) controllers.add(c.name);
    const resolve = (/** @type {string} */ file, /** @type {number} */ offset, /** @type {string} */ name) => {
      if (adapters.has(name) || controllers.has(name)) return;
      ctx.report({ file, offset, message: `sync: "${name}" never binds: no adapter and no controller registers the name "${name}" (adapters: ${[...adapters].join(", ") || "none"})` });
    };
    for (const file of ctx.files()) {
      if (!file.endsWith(".js") || file.endsWith(".test.js") || file.startsWith("tests/")) continue;
      for (const match of (ctx.read(file) || "").matchAll(SYNC_TARGET)) resolve(file, /** @type {number} */ (match.index), match[1]);
    }
    for (const c of ctx.controllers())
      for (const entry of c.syncEntries)
        if (entry.target) resolve(c.file, entry.targetOffset, entry.target);
  },
});
