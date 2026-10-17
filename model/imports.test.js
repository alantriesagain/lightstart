import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
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
  if (!spec.startsWith(pkg.name)) return null;
  const sub = `.${spec.slice(pkg.name.length)}`;
  const mapped = exportFile(pkg.exports[sub]);
  return resolve(ROOT, mapped ?? sub);
};

/**
 * Every module the runtime imports of `entry` reach, as paths relative to light.
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
  visit(resolve(ROOT, entry));
  return [...seen].map((file) => relative(ROOT, file));
};

/** @param {string} dir @returns {string[]} */
const sourceFiles = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|ts)$/.test(entry.name) && !/\.test\.js$/.test(entry.name) && entry.name !== "types.ts" ? [path] : [];
  });

const entry = (/** @type {string} */ key) => /** @type {string} */ (exportFile(pkg.exports[key])).replace(/^\.\//, "");
const inModel = (/** @type {string} */ file) => file.startsWith("model/");

describe("@bootstrapp/light/model: nothing loads what it did not ask for", () => {
  it("no entry outside the model, and no component, reaches model/", () => {
    const outside = Object.keys(pkg.exports).filter((key) => !key.startsWith("./model") && !key.includes("*")).map((key) => exportFile(pkg.exports[key])).filter((file) => typeof file === "string");
    for (const file of [...outside, ...sourceFiles("components")]) {
      const leaked = reach(file).filter(inModel);
      assert.deepEqual(leaked, [], `${file} reaches ${leaked.join(", ")}`);
    }
  });

  it("the registry a page talks to a worker through loads no store, no adapter and no binding", () => {
    const reached = reach(entry("./model"));
    for (const file of ["model/store.ts", "model/indexeddb.ts", "model/binder.js", "model/factory.ts"]) assert.ok(!reached.includes(file), `./model reaches ${file}`);
  });

  it("each model entry loads its own code and no sibling entry", () => {
    const owned = {
      "./model": ["model/index.ts", "model/changes.ts", "model/config.ts"],
      "./model/store": ["model/store.ts", "model/factory.ts"],
      "./model/adapter": ["model/adapter.ts", "model/factory.ts"],
      "./model/indexeddb": ["model/indexeddb.ts", "model/config.ts"],
      "./model/binder": ["model/binder.js", "controller/resource.js"],
      "./model/slug": ["model/slug.ts"],
    };
    const entries = Object.keys(owned).map(entry);
    for (const [key, files] of Object.entries(owned)) {
      const reached = reach(entry(key));
      for (const file of files) assert.ok(reached.includes(file), `${key} loads ${file}`);
      const foreign = reached.filter((file) => entries.includes(file) && file !== entry(key) && !(key === "./model/binder" && file === entry("./model")));
      assert.deepEqual(foreign, [], `${key} reaches the entries ${foreign.join(", ")}`);
    }
  });
});
