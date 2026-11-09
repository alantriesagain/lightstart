import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const LIGHT = resolve(ROOT, "../light");
const lightPkg = JSON.parse(readFileSync(join(LIGHT, "package.json"), "utf8"));
const RUNTIME_IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm;

/** @param {unknown} target */
const exportFile = (target) =>
  typeof target === "string" ? target : /** @type {{ default?: string }} */ (target)?.default;

/**
 * The file a specifier names: a relative path, or light's own package name
 * through its export map. Anything else lies outside light.
 * @param {string} spec
 * @param {string} from
 */
const resolveSpec = (spec, from) => {
  if (spec.startsWith(".")) return resolve(dirname(from), spec);
  if (!spec.startsWith(lightPkg.name)) return null;
  const sub = spec.slice(lightPkg.name.length);
  const key = sub === "" ? "." : `.${sub}`;
  const mapped = exportFile(lightPkg.exports[key]);
  return resolve(LIGHT, mapped ?? sub);
};

/**
 * Every light module the runtime imports of `entry` reach, relative to the
 * light package.
 * @param {string} entry
 */
const reach = (entry) => {
  const seen = new Set();
  const visit = (/** @type {string} */ file) => {
    if (seen.has(file) || !existsSync(file) || !/\.(js|ts)$/.test(file)) return;
    seen.add(file);
    for (const [, spec] of readFileSync(file, "utf8").matchAll(RUNTIME_IMPORT)) {
      const next = resolveSpec(spec, file);
      if (next) visit(next);
    }
  };
  visit(entry);
  return [...seen].map((file) => relative(LIGHT, file));
};

/** @param {string} dir @returns {string[]} */
const sourceFiles = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|ts)$/.test(entry.name) && !entry.name.endsWith(".test.js") && entry.name !== "types.ts" ? [path] : [];
  });

const sources = sourceFiles(".").map((file) => join(ROOT, file));

describe("@lightstart/components: nothing loads light's private engines", () => {
  it("no component reaches the controller", () => {
    for (const file of sources) {
      const leaked = reach(file).filter((path) => path.startsWith("controller/"));
      assert.deepEqual(leaked, [], `${relative(ROOT, file)} reaches ${leaked.join(", ")}`);
    }
  });

  it("no component reaches the model", () => {
    for (const file of sources) {
      const leaked = reach(file).filter((path) => path.startsWith("model/"));
      assert.deepEqual(leaked, [], `${relative(ROOT, file)} reaches ${leaked.join(", ")}`);
    }
  });

  it("no component reaches the theme's class engine", () => {
    for (const file of sources) {
      const leaked = reach(file).filter((path) => path.startsWith("theme/classes/"));
      assert.deepEqual(leaked, [], `${relative(ROOT, file)} reaches ${leaked.join(", ")}`);
    }
  });
});
