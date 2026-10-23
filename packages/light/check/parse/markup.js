/**
 * @bootstrapp/light/check/parse/markup.js: a template's markup as a tree.
 * Each `${...}` is read as an expression (brace depth, nested templates and
 * string literals honoured); the rest is tokenised into elements, attributes,
 * text and comments, every node carrying its offset in the source file. A
 * binding's kind follows the runtime's prefixes: `.prop`, `?bool`, `@event`.
 * The parse never throws: a tag the text does not finish ends where the text
 * does, and a stray close tag closes to the nearest open element of its name.
 */

import { blank } from "../strip-comments.js";
import { htmlTemplates, scanTemplateEnd } from "./templates.js";

/** @import { MarkupAttribute, MarkupElement, MarkupNode, ParsedTemplate } from "../types.ts" */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);
/** @type {Record<string, MarkupAttribute["kind"]>} */
const KINDS = { ".": "prop", "?": "bool", "@": "event" };

/**
 * @param {string} src
 * @param {string} quote
 * @param {number} from
 */
const stringEnd = (src, quote, from) => {
  for (let i = from; i < src.length; i++)
    if (src[i] === "\\") i++;
    else if (src[i] === quote) return i;

  return src.length;
};

/**
 * The end (exclusive) of the `${...}` whose `$` sits at `open`.
 * @param {string} src
 * @param {number} open
 */
const expressionEnd = (src, open) => {
  let depth = 0;
  for (let i = open + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") i++;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      if (--depth === 0) return i + 1;
    } else if (ch === "`") {
      const end = scanTemplateEnd(src, i + 1);
      if (end === -1) return src.length;
      i = end;
    } else if (ch === '"' || ch === "'") i = stringEnd(src, ch, i + 1);
  }
  return src.length;
};

/**
 * Every `${...}` of the template's text, as `[from, to)` ranges.
 * @param {string} content
 */
const expressionsOf = (content) => {
  /** @type {Map<number, number>} */
  const out = new Map();
  for (let i = 0; i < content.length; i++)
    if (content[i] === "$" && content[i + 1] === "{" && content[i - 1] !== "\\") {
      const to = expressionEnd(content, i);
      out.set(i, to);
      i = to - 1;
    }
  return out;
};

/**
 * @param {string} content the template's text, between its backticks
 * @param {number} start the offset of that text in the file
 * @returns {ParsedTemplate}
 */
export const parseMarkup = (content, start) => {
  const exprEnd = expressionsOf(content);
  const lower = content.toLowerCase();
  const n = content.length;
  /** @type {MarkupElement} */
  const root = { kind: "element", tag: "", offset: start, end: start + n, attrs: [], children: [], parent: null };
  let current = root;

  /**
   * The text run `[from, to)` as one text node (expressions blanked) and one
   * expression node per `${}` in it.
   * @param {number} from
   * @param {number} to
   */
  const flushText = (from, to) => {
    if (to <= from) return;
    let masked = "";
    /** @type {MarkupNode[]} */
    const expressions = [];
    for (let i = from; i < to; ) {
      const end = exprEnd.get(i);
      if (end === undefined) {
        masked += content[i];
        i++;
        continue;
      }
      const stop = Math.min(end, to);
      masked += blank(content.slice(i, stop));
      expressions.push({ kind: "expression", offset: start + i, end: start + stop });
      i = stop;
    }
    if (masked.trim()) current.children.push({ kind: "text", text: masked, offset: start + from });
    current.children.push(...expressions);
  };

  /**
   * The attributes of the open tag whose name ends at `from`; answers where
   * the tag ends and how it closed.
   * @param {MarkupElement} el
   * @param {number} from
   */
  const readAttributes = (el, from) => {
    let j = from;
    while (j < n) {
      const ch = content[j];
      const skip = exprEnd.get(j);
      if (skip !== undefined) {
        j = skip;
        continue;
      }
      if (/\s/.test(ch)) {
        j++;
        continue;
      }
      if (ch === ">") return { at: j + 1, closed: true, selfClosing: false };
      if (ch === "/" && content[j + 1] === ">") return { at: j + 2, closed: true, selfClosing: true };
      if (ch === "<") return { at: j, closed: false, selfClosing: false };
      const prefix = ch in KINDS ? ch : "";
      let k = j + prefix.length;
      while (k < n && !/[\s=>]/.test(content[k]) && !(content[k] === "/" && content[k + 1] === ">") && !exprEnd.has(k)) k++;
      const name = content.slice(j + prefix.length, k);
      if (!name) {
        j = k + 1;
        continue;
      }
      let m = k;
      while (m < n && /[ \t\r\n]/.test(content[m])) m++;
      /** @type {Array<{ offset: number, end: number }>} */
      const expressions = [];
      /** @type {string[]} */
      let statics = [""];
      let value = "";
      /** @type {number | null} */
      let valueOffset = null;
      let next = k;
      if (content[m] === "=") {
        m++;
        while (m < n && /[ \t\r\n]/.test(content[m])) m++;
        const quote = content[m];
        const quoted = quote === '"' || quote === "'";
        const vs = quoted ? m + 1 : m;
        let ve = vs;
        while (ve < n && (quoted ? content[ve] !== quote : !/[\s>]/.test(content[ve]) && !(content[ve] === "/" && content[ve + 1] === ">"))) {
          const end = exprEnd.get(ve);
          ve = end === undefined ? ve + 1 : end;
        }
        statics = [];
        let seg = vs;
        for (let p = vs; p < ve; ) {
          const end = exprEnd.get(p);
          if (end === undefined) {
            p++;
            continue;
          }
          const stop = Math.min(end, ve);
          statics.push(content.slice(seg, p));
          expressions.push({ offset: start + p, end: start + stop });
          seg = stop;
          p = stop;
        }
        statics.push(content.slice(seg, ve));
        value = content.slice(vs, ve);
        valueOffset = start + vs;
        next = quoted ? Math.min(ve + 1, n) : ve;
      }
      el.attrs.push({ name, kind: prefix ? KINDS[prefix] : "attr", statics, expressions, offset: start + j, value: expressions.length ? null : value, valueOffset });
      j = next;
    }
    return { at: n, closed: false, selfClosing: false };
  };

  let i = 0;
  let textFrom = 0;
  while (i < n) {
    const skip = exprEnd.get(i);
    if (skip !== undefined) {
      i = skip;
      continue;
    }
    if (content[i] !== "<") {
      i++;
      continue;
    }
    const next = content[i + 1] ?? "";
    if (content.startsWith("<!--", i)) {
      flushText(textFrom, i);
      const close = content.indexOf("-->", i + 4);
      i = close === -1 ? n : close + 3;
      textFrom = i;
      continue;
    }
    if (next === "!") {
      flushText(textFrom, i);
      const close = content.indexOf(">", i);
      i = close === -1 ? n : close + 1;
      textFrom = i;
      continue;
    }
    if (next === "/") {
      flushText(textFrom, i);
      const close = content.indexOf(">", i);
      const name = content.slice(i + 2, close === -1 ? n : close).trim().toLowerCase();
      i = close === -1 ? n : close + 1;
      textFrom = i;
      let el = current;
      while (el !== root && el.tag !== name) el = /** @type {MarkupElement} */ (el.parent);
      if (el !== root) {
        el.end = start + i;
        current = /** @type {MarkupElement} */ (el.parent);
      }
      continue;
    }
    if (!/[a-zA-Z]/.test(next)) {
      i++;
      continue;
    }
    flushText(textFrom, i);
    let j = i + 1;
    while (j < n && /[\w-]/.test(content[j])) j++;
    const tag = content.slice(i + 1, j).toLowerCase();
    /** @type {MarkupElement} */
    const el = { kind: "element", tag, offset: start + i, end: start + n, attrs: [], children: [], parent: current };
    current.children.push(el);
    const { at, closed, selfClosing } = readAttributes(el, j);
    i = at;
    textFrom = i;
    if (!closed || selfClosing || VOID.has(tag)) {
      el.end = start + i;
      continue;
    }
    if (RAW_TEXT.has(tag)) {
      const close = lower.indexOf(`</${tag}`, i);
      const to = close === -1 ? n : close;
      current = el;
      flushText(i, to);
      current = /** @type {MarkupElement} */ (el.parent);
      const gt = content.indexOf(">", to);
      i = gt === -1 ? n : gt + 1;
      el.end = start + i;
      textFrom = i;
      continue;
    }
    current = el;
  }
  flushText(textFrom, n);
  return { start, content, children: root.children };
};

/**
 * An attribute's value as written in the file, expressions included; empty
 * for a bare attribute.
 * @param {MarkupAttribute} attr
 * @param {string} source the file's text the attribute was parsed from
 */
export const rawValue = (attr, source) =>
  attr.valueOffset === null ? "" : source.slice(attr.valueOffset, attr.valueOffset + attr.statics.join("").length + attr.expressions.reduce((n, e) => n + e.end - e.offset, 0));

/**
 * The template at `start` and every template nested in its expressions, each
 * as a tree of its own: an element inside `\${items.map((i) => html\`...\`)}`
 * belongs to the inner template, with no parent in the outer one.
 * @param {string} content
 * @param {number} start
 * @returns {ParsedTemplate[]}
 */
export const parseTemplates = (content, start) => [
  parseMarkup(content, start),
  ...htmlTemplates(content).flatMap((nested) => parseTemplates(nested.content, start + nested.start)),
];

/**
 * Every text run of a template, depth-first, the ones outside any element
 * included.
 * @param {{ children: MarkupNode[] }} node
 * @returns {Generator<import("../types.ts").MarkupText>}
 */
export function* texts(node) {
  for (const child of node.children)
    if (child.kind === "text") yield child;
    else if (child.kind === "element") yield* texts(child);
}

/**
 * Every element of a template, depth-first.
 * @param {{ children: MarkupNode[] }} node
 * @returns {Generator<MarkupElement>}
 */
export function* elements(node) {
  for (const child of node.children)
    if (child.kind === "element") {
      yield child;
      yield* elements(child);
    }
}
