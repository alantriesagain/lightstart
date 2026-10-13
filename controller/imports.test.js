import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm;
const TYPE_IMPORT = /@import\s*(?:\{[^}]*\}|\w+)\s*from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

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
  if (!spec.startsWith(pkg.name)) return null;
  const sub = `.${spec.slice(pkg.name.length)}`;
  const mapped = exportFile(pkg.exports[sub === "." ? "." : sub]);
  return resolve(ROOT, mapped ?? sub);
};

/**
 * Every file the static imports of `entry` reach, as paths relative to light.
 * With `types`, type-only imports count too: `.ts` declarations, `@import`
 * tags and `import("...")` types, which is what a typechecker loads.
 * @param {string} entry
 * @param {{ types?: boolean }} [options]
 */
const reach = (entry, { types = false } = {}) => {
  const seen = new Set();
  const visit = (/** @type {string} */ file) => {
    if (seen.has(file) || !existsSync(file) || !(file.endsWith(".js") || (types && file.endsWith(".ts")))) return;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    const specs = [...source.matchAll(STATIC_IMPORT)].map(([, spec]) => spec);
    if (types) for (const [, tag, inline] of source.matchAll(TYPE_IMPORT)) specs.push(tag ?? inline);
    for (const spec of specs) {
      const next = resolveSpec(spec, file);
      if (next) visit(next);
    }
  };
  visit(resolve(ROOT, entry));
  return [...seen].map((file) => relative(ROOT, file));
};

/** @param {string} dir @returns {string[]} */
const jsFiles = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith(".js") && !entry.name.endsWith(".test.js") ? [path] : [];
  });

const inController = (/** @type {string} */ file) => file.startsWith("controller/");

describe("@bootstrapp/light/controller: nothing loads what it did not ask for", () => {
  it("no entry outside the controller, and no component, reaches controller/", () => {
    const entries = Object.entries(pkg.exports)
      .filter(([key]) => !key.startsWith("./controller") && !key.includes("*"))
      .map(([, target]) => exportFile(target))
      .filter((file) => typeof file === "string");
    for (const entry of [...entries, ...jsFiles("components")]) {
      const leaked = reach(entry).filter(inController);
      assert.deepEqual(leaked, [], `${entry} reaches ${leaked.join(", ")}`);
    }
  });

  it("each controller entry loads its own code and no sibling entry's", () => {
    const entry = (/** @type {string} */ key) => /** @type {string} */ (exportFile(pkg.exports[key]));
    const owned = {
      "./controller": ["controller/define.js", "controller/sync.js", "controller/config.js"],
      "./controller/resource": ["controller/resource.js", "controller/config.js"],
      "./controller/storage": ["controller/adapters/storage.js"],
      "./controller/document": ["controller/adapters/document.js"],
      "./controller/url": ["controller/adapters/url.js"],
      "./controller/view": ["controller/view.js", "controller/sync.js"],
    };
    const entryFiles = Object.keys(owned).map((key) => entry(key).replace(/^\.\//, ""));
    for (const [key, files] of Object.entries(owned)) {
      const reached = reach(entry(key)).filter(inController);
      for (const file of files) assert.ok(reached.includes(file), `${key} loads ${file}`);
      const foreign = reached.filter((file) => entryFiles.includes(file) && file !== entry(key).replace(/^\.\//, ""));
      assert.deepEqual(foreign, [], `${key} reaches the entries ${foreign.join(", ")}`);
    }
  });

  it("the controller's types load no DOM: a program that types a controller never takes in the browser view", () => {
    for (const entry of ["controller/types.ts", "controller/index.js"]) {
      const dom = reach(entry, { types: true }).filter((file) => file.startsWith("dom/") || file === "view/index.js" || file === "view/types.ts");
      assert.deepEqual(dom, [], `${entry} reaches ${dom.join(", ")}`);
    }
  });
});
