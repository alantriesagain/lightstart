/**
 * @file The package as npm gets it: the TypeScript sources and the node bin (tests and scripts left
 * out), the TypeScript as the JavaScript node runs inside `node_modules` with a `.d.ts` beside each
 * module, and a package.json whose exports name both. Types are stripped in place, so lines and
 * columns match the sources; relative `.ts` specifiers become `.js` in the JavaScript sources as
 * well. `npm run pack` stages it into `dist` and packs it there; `stage()` only stages.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEFT_OUT = new Set(["dist", "node_modules", "scripts", "test", "benchmarks"]);
const TS_SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\.ts\2/g;

/** Where the staged package lands. */
export const DIST = join(PACKAGE, "dist");

/** @param {string} dir @returns {string[]} */
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    LEFT_OUT.has(entry.name) || entry.name.startsWith(".") ? [] : entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);

/** @param {string} source */
const toJsSpecifiers = (source) => source.replace(TS_SPECIFIER, "$1$2$3.js$2");

/** @param {string} file */
const stripped = (file) => {
  const warn = process.emitWarning;
  process.emitWarning = () => {};
  try {
    return toJsSpecifiers(stripTypeScriptTypes(readFileSync(file, "utf8")));
  } finally {
    process.emitWarning = warn;
  }
};

/** @returns {{ dir: string, manifest: Record<string, unknown> }} */
export const stage = () => {
  rmSync(DIST, { recursive: true, force: true });
  const sources = walk(PACKAGE)
    .map((file) => relative(PACKAGE, file))
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));
  for (const file of [...sources, "README.md", "LICENSE"].filter((f) => existsSync(join(PACKAGE, f)))) {
    mkdirSync(dirname(join(DIST, file)), { recursive: true });
    cpSync(join(PACKAGE, file), join(DIST, file));
  }
  writeFileSync(join(DIST, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      allowImportingTsExtensions: true,
      rewriteRelativeImportExtensions: true,
      target: "es2024",
      module: "esnext",
      moduleResolution: "bundler",
      lib: ["es2024"],
      types: ["node"],
      typeRoots: [join(PACKAGE, "node_modules", "@types")],
      strict: true,
      skipLibCheck: true,
    },
    include: ["**/*.ts"],
  }));
  execFileSync(join(PACKAGE, "node_modules", ".bin", "tsc"), ["-p", DIST], { stdio: "inherit" });
  for (const file of walk(DIST))
    if (file.endsWith(".d.ts")) writeFileSync(file, readFileSync(file, "utf8").replace(/(["'])(\.{1,2}\/[^"']+)\.ts\1/g, "$1$2.js$1"));
    else if (file.endsWith(".ts")) {
      writeFileSync(file.replace(/\.ts$/, ".js"), stripped(file));
      rmSync(file);
    } else if (file.endsWith(".js")) writeFileSync(file, toJsSpecifiers(readFileSync(file, "utf8")));
    else if (relative(DIST, file) === "tsconfig.json") rmSync(file);

  const { scripts: _, devDependencies: __, exports, ...rest } = /** @type {{ exports: Record<string, string>, [key: string]: unknown }} */ (JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")));
  /** @type {Record<string, string | { types: string, default: string }>} */
  const shipped = {};
  for (const [key, target] of Object.entries(exports))
    shipped[key] = key === "./*" ? "./*" : { types: target.replace(/\.ts$/, ".d.ts"), default: target.replace(/\.ts$/, ".js") };
  const manifest = { ...rest, exports: shipped, files: ["**/*.js", "**/*.d.ts", "bin/**"] };
  writeFileSync(join(DIST, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { dir: DIST, manifest };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  stage();
  execFileSync("npm", ["pack"], { cwd: DIST, stdio: "inherit" });
}
