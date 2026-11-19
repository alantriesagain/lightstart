/**
 * @file `light new model|view|controller`: write one piece into an app that
 * `light new web` or `light new tui` made. The app's `src/app.ts` or
 * `src/app.js` names its host and language; the files follow the scaffold's
 * model, controller and view shapes for that language and host.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/** The piece words `light new` takes inside an app. */
export const PIECES = ["model", "view", "controller"] as const;

/** One of the piece words. */
export type Piece = (typeof PIECES)[number];

/** A field type `--fields` accepts. */
export type FieldType = "string" | "boolean" | "number" | "array" | "object";

/** A field parsed from `--fields`. */
export type Field = { name: string; type: FieldType; required: boolean };

/** Whether `word` is a piece. */
export const isPiece = (word: string): word is Piece => (PIECES as readonly string[]).includes(word);

/** The app a command runs inside: its language, its host and its routes file. */
export type AppInfo = { language: "js" | "ts"; host: "web" | "tui"; routes: string };

/** Read the app in `cwd`; null when it is not one, an error when it has both app files. */
export const appAt = (cwd: string): AppInfo | null => {
  const ts = join(cwd, "src", "app.ts");
  const js = join(cwd, "src", "app.js");
  const hasTs = existsSync(ts);
  const hasJs = existsSync(js);
  if (hasTs && hasJs) throw new Error("The app has both src/app.ts and src/app.js; keep one of them.");
  const path = hasTs ? ts : hasJs ? js : null;
  if (path === null) return null;
  const source = readFileSync(path, "utf8");
  const host: "web" | "tui" = /host\s*:\s*["']tui["']/.test(source) ? "tui" : "web";
  const language: "js" | "ts" = path === ts ? "ts" : "js";
  const routes = existsSync(join(cwd, "src", `routes.${language}`)) ? join(cwd, "src", `routes.${language}`) : join(cwd, "src", "routes.ts");
  return { language, host, routes };
};

const FIELD_TYPES: readonly FieldType[] = ["string", "boolean", "number", "array", "object"];

/** Parse `--fields "title:string,done:boolean"`: `?` optional (the default), `!` required. */
export const parseFields = (spec: string | undefined): Field[] => {
  if (spec === undefined || spec.trim().length === 0) return [];
  return spec.split(",").map((entry) => {
    const text = entry.trim();
    const colon = text.indexOf(":");
    if (colon < 1 || colon === text.length - 1) throw new Error(`The field "${text}" is not name:type.`);
    const name = text.slice(0, colon).trim();
    let type = text.slice(colon + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`The field name "${name}" is not an identifier.`);
    if (name === "id") throw new Error("The model writes its own id; do not name a field id.");
    let required = false;
    if (type.endsWith("!")) {
      required = true;
      type = type.slice(0, -1);
    } else if (type.endsWith("?")) {
      type = type.slice(0, -1);
    }
    if (!(FIELD_TYPES as readonly string[]).includes(type)) throw new Error(`The field "${name}" has type "${type}"; the types are ${FIELD_TYPES.join(", ")}.`);
    return { name, type: type as FieldType, required };
  });
};

const camel = (name: string): string => {
  const parts = name.split(/[^A-Za-z0-9]+/).filter((part) => part.length > 0);
  const text = parts.map((part, index) => (index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1))).join("");
  const safe = text.length === 0 ? "entry" : text;
  return /^[0-9]/.test(safe) ? `_${safe}` : safe;
};

const pascal = (name: string): string => {
  const parts = name.split(/[^A-Za-z0-9]+/).filter((part) => part.length > 0);
  const text = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  const safe = text.length === 0 ? "Entry" : text;
  return /^[0-9]/.test(safe) ? `_${safe}` : safe;
};

const descriptorOf = (field: Field): string => {
  if (field.required) {
    switch (field.type) {
      case "string":
        return "T.string({ required: true })";
      case "boolean":
        return "T.boolean({ required: true })";
      case "number":
        return "T.number({ required: true })";
      case "array":
        return "T.array({ required: true })";
      case "object":
        return "T.object({ required: true })";
    }
  }
  switch (field.type) {
    case "string":
      return 'T.string({ defaultValue: "" })';
    case "boolean":
      return "T.boolean({ defaultValue: false })";
    case "number":
      return "T.number({ defaultValue: 0 })";
    case "array":
      return "T.array({ defaultValue: [] })";
    case "object":
      return "T.object({ defaultValue: {} })";
  }
};

const fieldLines = (fields: readonly Field[], indent: string): string[] => fields.map((field) => `${indent}${field.name}: ${descriptorOf(field)},`);

const modelSource = (name: string, fields: readonly Field[], language: "js" | "ts", host: "web" | "tui"): string => {
  const variable = camel(name);
  const row = pascal(name);
  if (host === "tui") {
    return [
      "/**",
      ` * @file The ${name} model: its fields and their types.`,
      " */",
      'import T from "@lightstart/light/types";',
      'import { defineModel } from "@lightstart/light/model";',
      "",
      'import type { ModelSchema } from "@lightstart/light/model";',
      "",
      "const schema: ModelSchema = {",
      ...fieldLines(fields, "  "),
      "};",
      "",
      `export default defineModel("${name}", schema);`,
      "",
    ].join("\n");
  }
  const imports = ['import T from "@lightstart/light/types";', 'import { defineModel } from "@lightstart/light/model";', ""];
  if (language === "ts") {
    return [
      ...imports,
      'import type { ModelRow } from "@lightstart/light/model";',
      "",
      `const ${variable} = defineModel("${name}", {`,
      ...fieldLines(fields, "  "),
      "});",
      "",
      `export type ${row} = ModelRow<typeof ${variable}>;`,
      "",
      `export default ${variable};`,
      "",
    ].join("\n");
  }
  return [
    ...imports,
    `const ${variable} = defineModel("${name}", {`,
    ...fieldLines(fields, "  "),
    "});",
    "",
    `/** A ${name} as a query answers it, typed from the schema. @typedef {import("@lightstart/light/model").ModelRow<typeof ${variable}>} ${row} */`,
    "",
    `export default ${variable};`,
    "",
  ].join("\n");
};

const controllerSource = (name: string, model: string | undefined, info: AppInfo): string => {
  const className = pascal(name);
  const ext = info.host === "tui" ? "ts" : info.language;
  const lines: string[] = [
    "/**",
    ` * @file The ${name} controller.`,
    " */",
    'import { Controller } from "@lightstart/light/controller/class";',
  ];
  if (model !== undefined) {
    lines.push('import { liveRows } from "@lightstart/light/model/binder";');
    lines.push(`import ${camel(model)} from "../models/${model}.${ext}";`);
    if (info.host === "tui") {
      const rowClass = `${pascal(model)}Row`;
      lines.push("");
      lines.push(`import { ${rowClass} } from "../../.light/models.ts";`);
    } else if (info.language === "ts") {
      lines.push(`import type { ${pascal(model)} } from "../models/${model}.ts";`);
    } else {
      lines.push("");
      lines.push(`/** @import { ${pascal(model)} } from "../models/${model}.js" */`);
    }
  }
  lines.push("");
  lines.push(`class ${className} extends Controller {`);
  if (model !== undefined) {
    if (info.host === "tui") lines.push(`  readonly rows = liveRows<${pascal(model)}Row>(this, ${camel(model)}, () => ({}), ${pascal(model)}Row.of);`);
    else if (info.language === "ts") lines.push(`  readonly rows = liveRows<${pascal(model)}>(this, ${camel(model)}, () => ({}));`);
    else lines.push(`  /** @type {import("@lightstart/light/model/binder").LiveRows<${pascal(model)}>} */`, `  rows = liveRows(this, ${camel(model)}, () => ({}));`);
    lines.push("");
  }
  lines.push("  constructor() {");
  lines.push(`    super("${name}");`);
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push(`export default new ${className}();`);
  lines.push("");
  return lines.join("\n");
};

const viewSource = (tag: string, info: AppInfo): string => {
  const className = pascal(tag);
  if (info.host === "tui") {
    return [
      "/**",
      ` * @file The ${tag} view.`,
      " */",
      'import { View, define, html } from "@lightstart/light/native/tui";',
      "",
      `export default class ${className} extends View {`,
      "  override render(): unknown {",
      `    return html\`<p>${tag}</p>\`;`,
      "  }",
      "}",
      "",
      `define("${tag}", ${className});`,
      "",
    ].join("\n");
  }
  return [
    "/**",
    ` * @file The ${tag} view.`,
    " */",
    'import View from "@lightstart/light";',
    'import { html } from "@lightstart/light/html";',
    "",
    `class ${className} extends View {`,
    "  render() {",
    `    return html\`<p>${tag}</p>\`;`,
    "  }",
    "}",
    "",
    `View.register("${tag}", ${className});`,
    "",
  ].join("\n");
};

/** What a piece command needs. */
export type PieceOptions = {
  piece: Piece;
  name: string;
  cwd: string;
  fields?: string | undefined;
  model?: string | undefined;
};

/** Write one piece into the app at `cwd`; answer the path and the next step. */
export const generatePiece = (options: PieceOptions): { path: string; next: string } => {
  const info = appAt(options.cwd);
  if (info === null) throw new Error(`light new ${options.piece} runs inside an app made by light new web or light new tui.`);
  const ext = info.host === "tui" ? "ts" : info.language;
  let file: string;
  let source: string;
  let next: string;
  if (options.piece === "model") {
    file = join(options.cwd, "src", "models", `${options.name}.${ext}`);
    source = modelSource(options.name, parseFields(options.fields), info.language, info.host);
    next = `follow it from a controller: light new controller <name> --model ${options.name}`;
  } else if (options.piece === "controller") {
    if (options.model !== undefined && !existsSync(join(options.cwd, "src", "models", `${options.model}.${ext}`))) throw new Error(`There is no src/models/${options.model}.${ext} to follow.`);
    file = join(options.cwd, "src", "controllers", `${options.name}.${ext}`);
    source = controllerSource(options.name, options.model, info);
    next = "import it in a view that writes its state.";
  } else {
    if (!options.name.includes("-")) throw new Error(`The view tag "${options.name}" needs a hyphen.`);
    file = join(options.cwd, "src", "views", `${options.name}.${ext}`);
    source = viewSource(options.name, info);
    next = info.host === "web" ? `add a route in ${relative(options.cwd, info.routes)}.` : "draw it from another view.";
  }
  if (existsSync(file)) throw new Error(`${relative(options.cwd, file)} already exists.`);
  writeFileSync(file, source);
  return { path: file, next };
};
