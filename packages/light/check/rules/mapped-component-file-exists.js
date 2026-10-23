import { defineRule } from "../define.js";

const normalize = (/** @type {string} */ value) => value.replace(/^\.\//, "").replace(/\/$/, "");

export default defineRule({
  severity: "error",
  description: "every bootstrapp.components entry points at a file, or a directory holding files, that exists",
  why: "the loader resolves a tag through this map and fetches whatever it names, so a stale entry is a tag that 404s the first time something renders it, with nothing at build or check time to say so. mapped-component-declares-tag skips a missing file by design, which is what let an entry survive the deletion of the directory it named",
  appliesTo: { when: (ctx) => !!ctx.pkg?.bootstrapp?.components },
  check(ctx) {
    const components = /** @type {Record<string, unknown>} */ (ctx.pkg?.bootstrapp?.components);
    if (!components || typeof components !== "object") return;
    const files = ctx.files();
    const known = new Set(files);
    const exists = (/** @type {string} */ file) => known.has(file) || known.has(file.replace(/\.js$/, ".ts"));
    const manifest = ctx.read("package.json") || "";
    const at = (/** @type {string} */ value) => {
      const found = manifest.indexOf(`"${value}"`);
      return found === -1 ? 0 : found;
    };

    for (const [prefix, value] of Object.entries(components)) {
      if (typeof value === "string") {
        const dir = normalize(value);
        if (!dir || files.some((file) => file.startsWith(`${dir}/`))) continue;
        ctx.report({
          file: "package.json",
          offset: at(value),
          message: `components.${prefix} points at "${value}", a directory with no files; every tag it would serve 404s`,
        });
        continue;
      }
      if (!value || typeof value !== "object") continue;
      for (const [key, file] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
        if (typeof file !== "string" || exists(normalize(file))) continue;
        ctx.report({
          file: "package.json",
          offset: at(file),
          message: `components.${prefix}.${key} points at "${file}", which does not exist; <${prefix}-${key}> 404s the first time something renders it`,
        });
      }
    }
  },
});
