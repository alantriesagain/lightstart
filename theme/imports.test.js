import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const RUNTIME_IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm;
const DOM_NAME = /\b(Node|Element|Document|DOMTokenList|HTMLElement|MutationObserver)\b/;

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
const inClasses = (/** @type {string} */ file) => file.startsWith("theme/classes/");

const codeOf = (/** @type {string} */ file) => readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((line) => !/^\s*\/\//.test(line)).join("\n");

describe("@bootstrapp/light/theme/classes: the engine stands alone", () => {
  it("no entry outside the theme, and no component, reaches the engine", () => {
    const outside = Object.keys(pkg.exports).filter((key) => !key.startsWith("./theme") && !key.includes("*")).map((key) => exportFile(pkg.exports[key])).filter((file) => typeof file === "string");
    for (const file of [...outside, ...sourceFiles("components")]) {
      const leaked = reach(file).filter(inClasses);
      assert.deepEqual(leaked, [], `${file} reaches ${leaked.join(", ")}`);
    }
  });

  it("the engine reaches nothing outside its own directory, and the tokens nothing at all", () => {
    for (const file of reach(entry("./theme/classes"))) assert.ok(inClasses(file), `./theme/classes reaches ${file}`);
    assert.deepEqual(reach(entry("./theme/tokens")), ["theme/tokens.ts"]);
    assert.ok(!reach(entry("./theme/classes")).includes("theme/runtime.js"), "./theme/classes reaches the browser runtime");
    assert.ok(!reach(entry("./theme/classes")).includes("theme/classes/palette.js"), "./theme/classes reaches the palette");
  });

  it("the baked styler reaches the terminal's class hook alone, no engine and no tokens", () => {
    assert.deepEqual(reach("theme/baked.ts"), ["theme/baked.ts", "tdom/classes.ts"]);
  });

  it("the browser runtime reaches the engine and nothing of the view or the hosts", () => {
    for (const file of reach(entry("./theme/runtime"))) assert.ok(file.startsWith("theme/"), `./theme/runtime reaches ${file}`);
  });

  it("the engine names no type of a document", () => {
    for (const file of [...reach(entry("./theme/classes")), "theme/classes/types.ts"]) assert.ok(!DOM_NAME.test(codeOf(file)), `${file} names a DOM type`);
  });
});
