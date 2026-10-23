/**
 * @bootstrapp/light/theme/bake: `light classes:bake <entry> -o <file> [--scheme a,b] [--theme <file>] [--check]`.
 * Walks the entry's runtime imports, finds every `class=` value the `html`
 * templates write (a literal, or an expression whose every leaf is a string
 * literal), compiles each through `TerminalClasses` per scheme and writes a
 * module of `BakedEntry` tables, one export per scheme, for `BakedClasses`
 * to answer at run time with no engine in the binary. A value the baker
 * cannot read as literals, and a class the terminal ignores, are problems
 * named by file, line and column, and fail the bake. `--check` compares the
 * rendered module with the file on disk and fails on drift instead of writing.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TerminalClasses } from "./terminal.ts";

/** @import { ThemeData } from "./tokens.ts" */
/** @import { BakedEntry, BakedProp } from "./baked.ts" */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_IMPORT = /^\s*(?:import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/gm;
const ATTR = /\bclass=(?:"([^"]*)"|'([^']*)')/g;
const OPEN = /\bclass=(["']?)$/;
const UNTERMINATED = /\bclass=["'][^"']*$/;

export const TYPESCRIPT_HINT = "light classes:bake reads templates with TypeScript.\n  Install it where you are running from:  npm i -D typescript";

/** @param {unknown} target */
const exportFile = (target) => (typeof target === "string" ? target : /** @type {{ default?: string }} */ (target)?.default);

/**
 * The file a specifier names: a relative path (a `.js` that is a `.ts` on disk included), or light's own package name through its export map; anything else lies outside light.
 * @param {string} spec
 * @param {string} from
 * @param {{ name: string, exports: Record<string, unknown> }} pkg
 */
const resolveSpec = (spec, from, pkg) => {
  if (spec.startsWith(".")) {
    const file = resolve(dirname(from), spec);
    return existsSync(file) || !file.endsWith(".js") ? file : file.replace(/\.js$/, ".ts");
  }
  if (!spec.startsWith(pkg.name)) return null;
  const mapped = exportFile(pkg.exports[`.${spec.slice(pkg.name.length)}`]);
  return mapped ? resolve(ROOT, mapped) : null;
};

/**
 * The string literals an attribute value's expression is made of: the literal itself, both branches of a ternary, both sides of `||` and `??`. Answers null for any other leaf.
 * @param {import("typescript").Node} node
 * @param {typeof import("typescript")} ts
 * @param {string[]} out
 * @returns {boolean}
 */
const literalLeaves = (node, ts, out) => {
  let expr = node;
  while (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr)) expr = expr.expression;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    out.push(expr.text);
    return true;
  }
  if (ts.isConditionalExpression(expr)) return literalLeaves(expr.whenTrue, ts, out) && literalLeaves(expr.whenFalse, ts, out);
  if (ts.isBinaryExpression(expr) && (expr.operatorToken.kind === ts.SyntaxKind.BarBarToken || expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
    return literalLeaves(expr.left, ts, out) && literalLeaves(expr.right, ts, out);
  return false;
};

/**
 * Every `class=` value the `html` templates of one source write, and the sites the baker cannot read.
 * @param {string} source
 * @param {string} file the path problems name
 * @param {typeof import("typescript")} ts
 * @returns {{ classes: string[], problems: string[] }}
 */
export const classStringsOf = (source, file, ts) => {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  /** @type {Set<string>} */
  const classes = new Set();
  /** @type {string[]} */
  const problems = [];
  /** @param {import("typescript").Node} node @param {string} what */
  const problem = (node, what) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    problems.push(`${file}:${String(line + 1)}:${String(character + 1)}: ${what}`);
  };
  /** @param {string} text */
  const collect = (text) => {
    for (const m of text.matchAll(ATTR)) classes.add(m[1] ?? m[2] ?? "");
  };
  /** @param {import("typescript").Node} node */
  const visit = (node) => {
    if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === "html") {
      const tpl = node.template;
      if (ts.isNoSubstitutionTemplateLiteral(tpl)) collect(tpl.text);
      else {
        collect(tpl.head.text);
        tpl.templateSpans.forEach((span, i) => {
          const before = i === 0 ? tpl.head.text : tpl.templateSpans[i - 1].literal.text;
          const open = OPEN.exec(before);
          if (open) {
            const after = span.literal.text;
            const quote = open[1];
            /** @type {string[]} */
            const leaves = [];
            if (quote ? !after.startsWith(quote) : after.length > 0 && !/^[\s>/]/.test(after)) problem(span.expression, "class= mixes a binding with text; write the whole value as literals");
            else if (literalLeaves(span.expression, ts, leaves)) for (const cls of leaves) classes.add(cls);
            else problem(span.expression, "class= takes a value that is not a string literal, a ternary or an alternation of them");
          } else if (UNTERMINATED.test(before)) problem(span.expression, "class= mixes text with a binding; write the whole value as literals");
          collect(span.literal.text);
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { classes: [...classes].sort(), problems };
};

/**
 * The class strings every template the entry's runtime imports reach writes.
 * @param {string} entry a path relative to light's root or absolute
 * @param {typeof import("typescript")} ts
 * @returns {{ classes: string[], problems: string[], files: string[] }}
 */
export const collectClasses = (entry, ts) => {
  const pkg = /** @type {{ name: string, exports: Record<string, unknown> }} */ (JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")));
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Set<string>} */
  const classes = new Set();
  /** @type {string[]} */
  const problems = [];
  /** @param {string} file */
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file) || !/\.(js|ts)$/.test(file)) return;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    const found = classStringsOf(source, relative(ROOT, file), ts);
    for (const cls of found.classes) classes.add(cls);
    problems.push(...found.problems);
    for (const [, spec] of source.matchAll(RUNTIME_IMPORT)) {
      const next = resolveSpec(spec, file, pkg);
      if (next) visit(next);
    }
  };
  visit(resolve(ROOT, entry));
  return { classes: [...classes].sort(), problems, files: [...seen].map((file) => relative(ROOT, file)) };
};

/**
 * The baked tables, one per scheme: each class string with the props it means on the terminal; a class the terminal ignores is a problem.
 * @param {string[]} classes
 * @param {ThemeData} theme
 * @param {string[]} schemes
 * @returns {{ tables: Map<string, BakedEntry[]>, problems: string[] }}
 */
export const bakeTables = (classes, theme, schemes) => {
  /** @type {Map<string, BakedEntry[]>} */
  const tables = new Map();
  /** @type {string[]} */
  const problems = [];
  for (const scheme of schemes) {
    const styler = new TerminalClasses(theme, scheme);
    tables.set(scheme, classes.map((cls) => [cls, styler.propsFor(cls).map((p) => /** @type {BakedProp} */ ([p.name, p.value, p.state]))]));
    for (const cls of styler.ignored) problems.push(`${scheme}: the terminal ignores "${cls}"`);
  }
  return { tables, problems };
};

/**
 * The generated module's text.
 * @param {Map<string, BakedEntry[]>} tables
 * @param {string} entry
 * @param {string} command the command line that regenerates the file
 */
export const render = (tables, entry, command) => {
  const lines = [
    "/**",
    ` * @file The class strings the templates reached from ${entry} write, as the props they mean on the terminal, one table per scheme. Generated by \`${command}\`: change a view and bake again.`,
    " */",
    "",
    '/** @import { BakedEntry } from "@bootstrapp/light/theme/baked" */',
  ];
  for (const [scheme, entries] of tables) {
    lines.push("", "/** @type {BakedEntry[]} */", `export const ${scheme} = [`);
    for (const [cls, props] of entries) lines.push(`  [${JSON.stringify(cls)}, [${props.map(([name, value, state]) => `[${JSON.stringify(name)}, ${JSON.stringify(value)}, ${String(state)}]`).join(", ")}]],`);
    lines.push("];");
  }
  return lines.join("\n") + "\n";
};

/**
 * The command: `<entry> -o <file> [--scheme a,b] [--theme <file>] [--check]`; answers whether it succeeded.
 * @param {string[]} argv
 */
export const bake = async (argv) => {
  let entry = "";
  let out = "";
  let schemes = ["dark", "light"];
  let themeFile = "";
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o") out = argv[++i] ?? "";
    else if (arg === "--scheme") schemes = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (arg === "--theme") themeFile = argv[++i] ?? "";
    else if (arg === "--check") check = true;
    else if (!arg.startsWith("-")) entry = arg;
  }
  if (!entry || !out) {
    console.error("Usage: light classes:bake <entry> -o <file> [--scheme dark,light] [--theme <file>] [--check]");
    return false;
  }
  /** @type {typeof import("typescript")} */
  let ts;
  try {
    ts = (await import("typescript")).default;
  } catch {
    console.error(TYPESCRIPT_HINT);
    return false;
  }
  const theme = /** @type {ThemeData} */ ((await import(themeFile ? pathToFileURL(resolve(themeFile)).href : "./themes/default.js")).default);
  const found = collectClasses(entry, ts);
  const baked = bakeTables(found.classes, theme, schemes);
  const problems = [...found.problems, ...baked.problems];
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    return false;
  }
  const command = ["light classes:bake", entry, "-o", out, "--scheme", schemes.join(","), ...(themeFile ? ["--theme", themeFile] : [])].join(" ");
  const text = render(baked.tables, entry, command);
  const target = resolve(out);
  if (check) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current === text) return true;
    console.error(`${out} is stale: run \`${command}\``);
    return false;
  }
  writeFileSync(target, text);
  console.log(`${out}: ${String(found.classes.length)} class strings from ${String(found.files.length)} files, schemes ${schemes.join(", ")}`);
  return true;
};
