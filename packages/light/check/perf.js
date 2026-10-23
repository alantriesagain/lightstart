/**
 * What the slow-code rules share: the project's `perf` block (under
 * `bootstrapp.check` in package.json), which turns the rules on and says which
 * folders they cover, which functions are hot and which sites are allowed
 * with a reason; the files in scope; and one parse per file per run.
 *
 * ```json
 * "check": {
 *   "perf": { "scope": ["html/", "dom/"], "native": ["html/", "view/core.ts"], "hot": ["html/parts.ts#ChildPart.commit"] },
 *   "allow": { "light/perf-no-delete": { "dom/view.js#View.adopt": "an own property set before upgrade only goes away with delete" } }
 * }
 * ```
 *
 * An allowlist key is a file (`file`) or a symbol in it (`file#Class.method`),
 * so it survives line moves; light has no inline suppression comments.
 */

import { sourceFile } from "./parse/ast.js";
import { symbolOf } from "./parse/symbols.js";

/** @import { Node, SourceFile } from "typescript" */
/** @import { CheckContext, ProjectModel } from "./types.ts" */

/**
 * @typedef {object} PerfConfig
 * @property {string[]} scope folders and files the slow-code rules read
 * @property {string[]} native the parts of `scope` that also compile natively
 * @property {string[]} hot functions, as `file#Symbol`, whose allocations are reported
 */

/** @param {unknown} value @returns {string[]} */
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

/** @param {ProjectModel} ctx @returns {Record<string, unknown>} */
const checkConfig = (ctx) => {
  const check = /** @type {unknown} */ (ctx.config?.check);
  return check && typeof check === "object" ? /** @type {Record<string, unknown>} */ (check) : {};
};

/**
 * The project's `perf` block, or null when it has none (the rules then do not apply).
 * @param {ProjectModel} ctx
 * @returns {PerfConfig | null}
 */
export const perfConfig = (ctx) => {
  const perf = checkConfig(ctx).perf;
  if (!perf || typeof perf !== "object") return null;
  const block = /** @type {Record<string, unknown>} */ (perf);
  return { scope: strings(block.scope), native: strings(block.native), hot: strings(block.hot) };
};

/** The gate the slow-code rules share: they apply to a project with a `perf` block. */
export const PERF_GATE = { when: (/** @type {ProjectModel} */ ctx) => perfConfig(ctx) !== null };

/**
 * The allowlist for one rule: `file` or `file#Symbol` keys, with their reasons.
 * @param {ProjectModel} ctx
 * @param {string} ruleId
 * @returns {Record<string, string>}
 */
export const allowlist = (ctx, ruleId) => {
  const allow = checkConfig(ctx).allow;
  if (!allow || typeof allow !== "object") return {};
  const entries = /** @type {Record<string, unknown>} */ (allow)[ruleId];
  return entries && typeof entries === "object" ? /** @type {Record<string, string>} */ (entries) : {};
};

/**
 * Whether `file` is one of `prefixes`: a folder written with its trailing slash, or a file.
 * @param {string} file
 * @param {string[]} prefixes
 */
export const inPrefixes = (file, prefixes) => prefixes.some((prefix) => (prefix.endsWith("/") ? file.startsWith(prefix) : file === prefix));

/** @param {string} file */
export const isTestFile = (file) => /\.test\.[jt]s$/.test(file) || file.startsWith("test/") || file.includes("/fixtures/");

/** @param {string} file */
export const isSource = (file) => /\.[jt]s$/.test(file) && !file.endsWith(".d.ts");

/** @type {WeakMap<object, Map<string, SourceFile>>} */
const parsed = new WeakMap();

/**
 * The file's syntax tree, parsed once per check run.
 * @param {ProjectModel} ctx
 * @param {string} file
 * @returns {SourceFile}
 */
export const parse = (ctx, file) => {
  let files = parsed.get(ctx);
  if (!files) parsed.set(ctx, (files = new Map()));
  let sf = files.get(file);
  if (!sf) files.set(file, (sf = sourceFile(ctx.read(file) ?? "", file)));
  return sf;
};

/**
 * @typedef {object} Site
 * @property {string} file
 * @property {number} offset
 * @property {string} symbol the named code around the site
 * @property {string} message
 */

/**
 * A site at `node`, named by the code around it.
 * @param {string} file
 * @param {SourceFile} sf
 * @param {Node} node
 * @param {string} message
 * @returns {Site}
 */
export const siteAt = (file, sf, node, message) => ({ file, offset: node.getStart(sf), symbol: symbolOf(node), message });

/**
 * Whether the allowlist covers a site: its file, or its symbol or a symbol around it.
 * @param {Record<string, string>} allowed
 * @param {Site} site
 */
export const isAllowed = (allowed, site) => {
  if (site.file in allowed) return true;
  const parts = site.symbol.split(".");
  for (let n = parts.length; n > 0; n--) if (`${site.file}#${parts.slice(0, n).join(".")}` in allowed) return true;
  return false;
};

/**
 * Report every site the allowlist does not cover.
 * @param {CheckContext} ctx
 * @param {string} ruleId
 * @param {Site[]} sites
 */
export const reportSites = (ctx, ruleId, sites) => {
  const allowed = allowlist(ctx, ruleId);
  for (const site of sites) if (!isAllowed(allowed, site)) ctx.report({ file: site.file, offset: site.offset, message: site.message });
};

/**
 * The source files a rule reads: those under `prefixes`, without tests and declaration files.
 * @param {ProjectModel} ctx
 * @param {string[]} prefixes
 */
export const filesIn = (ctx, prefixes) => ctx.files().filter((file) => isSource(file) && !isTestFile(file) && inPrefixes(file, prefixes));
