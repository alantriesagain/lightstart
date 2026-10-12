/**
 * @bootstrapp/light/html/tokenizer: marker markup to a template tree, for
 * hosts without an HTML parser of their own. The parser emits the static
 * markup of a template with a `<!--$--><!--/-->` pair at every child binding
 * and a `data-$$` attribute on every element with bound attributes; this
 * reads that markup (and, for `unsafeHTML`, any markup) into elements,
 * text and comments the way a browser would: tag and attribute names are
 * lowercased for HTML, void elements take no children, `<script>`,
 * `<style>`, `<textarea>` and `<title>` hold raw text, character references
 * are decoded. It does not reproduce the HTML parser's implied end tags or
 * table fixups: elements nest as written.
 */
import { HTML_KIND, MARKER_START } from "./constants.js";

/** @import { ParsedPart, PartSpec } from "./types.ts" */

const ELEMENT_MARKER = "data-$$";
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const HTML_RAW_TAGS = new Set(["script", "style", "textarea", "title"]);
const SVG_RAW_TAGS = new Set(["script", "style"]);
const ESCAPABLE_RAW_TAGS = new Set(["textarea", "title"]);
/** @type {Map<string, string>} */
const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", "\""],
  ["apos", "'"],
  ["nbsp", " "],
  ["copy", "©"],
  ["reg", "®"],
  ["hellip", "…"],
  ["mdash", "—"],
  ["ndash", "–"],
  ["laquo", "«"],
  ["raquo", "»"],
  ["times", "×"],
  ["middot", "·"],
  ["bull", "•"],
  ["rarr", "→"],
  ["larr", "←"],
  ["euro", "€"],
]);

/** @param {string} c */
const isWS = (c) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";

/** @param {string} c */
const isTagStart = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");

/** @param {string} c */
const isDigit = (c) => c >= "0" && c <= "9";

/** @param {string} c */
const isHexDigit = (c) => isDigit(c) || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");

/**
 * The text with its character references decoded: the named ones a
 * template is likely to carry, and every numeric one.
 * @param {string} s
 */
export const decodeEntities = (s) => {
  if (s.indexOf("&") < 0) return s;
  let out = "";
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charAt(i);
    if (c !== "&") {
      out += c;
      i++;
      continue;
    }
    const semi = s.indexOf(";", i + 1);
    if (semi < 0 || semi - i > 32) {
      out += c;
      i++;
      continue;
    }
    const name = s.slice(i + 1, semi);
    let decoded = "";
    if (name.length > 1 && name[0] === "#") {
      const hex = name[1] === "x" || name[1] === "X";
      const digits = hex ? name.slice(2) : name.slice(1);
      let ok = digits.length > 0;
      for (let k = 0; k < digits.length; k++) if (!(hex ? isHexDigit(digits.charAt(k)) : isDigit(digits.charAt(k)))) ok = false;
      if (ok) {
        const code = parseInt(digits, hex ? 16 : 10);
        if (code > 0 && code <= 0x10ffff) decoded = String.fromCodePoint(code);
      }
    } else decoded = ENTITIES.get(name) ?? "";
    if (decoded === "") {
      out += c;
      i++;
      continue;
    }
    out += decoded;
    i = semi + 1;
  }
  return out;
};

export class TplNode {}

export class TplText extends TplNode {
  /** @param {string} data */
  constructor(data) {
    super();
    /** @type {string} */
    this.data = data;
  }
}

export class TplComment extends TplNode {
  /** @param {string} data */
  constructor(data) {
    super();
    this.data = data;
  }
}

export class TplElement extends TplNode {
  /** @param {string} tag */
  constructor(tag) {
    super();
    this.tag = tag;
    /** @type {Map<string, string>} */
    this.attrs = new Map();
    /** @type {TplNode[]} */
    this.children = [];
    this.marked = false;
  }
}

class Tokenizer {
  /**
   * @param {string} markup
   * @param {number} kind
   */
  constructor(markup, kind) {
    this.markup = markup;
    this.html = kind === HTML_KIND;
    this.rawTags = this.html ? HTML_RAW_TAGS : SVG_RAW_TAGS;
    this.root = new TplElement("#root");
    /** @type {TplElement[]} */
    this.stack = [this.root];
    this.i = 0;
    this.text = "";
  }

  top() {
    return this.stack[this.stack.length - 1];
  }

  flushText() {
    if (this.text.length === 0) return;
    const siblings = this.top().children;
    const last = siblings.length > 0 ? siblings[siblings.length - 1] : null;
    if (last instanceof TplText) last.data += decodeEntities(this.text);
    else siblings.push(new TplText(decodeEntities(this.text)));
    this.text = "";
  }

  /** @param {string} name */
  normalizeName(name) {
    return this.html ? name.toLowerCase() : name;
  }

  /** @param {string} tag */
  closeTo(tag) {
    for (let k = this.stack.length - 1; k > 0; k--)
      if (this.stack[k].tag === tag) {
        this.stack.length = k;
        return;
      }
  }

  run() {
    const markup = this.markup;
    const n = markup.length;
    while (this.i < n) {
      const c = markup.charAt(this.i);
      if (c === "<") {
        if (markup.startsWith("<!--", this.i)) {
          this.flushText();
          const end = markup.indexOf("-->", this.i + 4);
          this.top().children.push(new TplComment(end < 0 ? markup.slice(this.i + 4) : markup.slice(this.i + 4, end)));
          this.i = end < 0 ? n : end + 3;
          continue;
        }
        if (markup.startsWith("<!", this.i) || markup.startsWith("<?", this.i)) {
          this.flushText();
          const end = markup.indexOf(">", this.i);
          this.i = end < 0 ? n : end + 1;
          continue;
        }
        const after = this.i + 2 < n ? markup.charAt(this.i + 2) : "";
        if (markup.charAt(this.i + 1) === "/" && isTagStart(after)) {
          this.flushText();
          const end = markup.indexOf(">", this.i);
          const name = this.normalizeName(markup.slice(this.i + 2, end < 0 ? n : end).trim());
          this.closeTo(name);
          this.i = end < 0 ? n : end + 1;
          continue;
        }
        const next = this.i + 1 < n ? markup.charAt(this.i + 1) : "";
        if (isTagStart(next)) {
          this.flushText();
          this.openTag();
          continue;
        }
      }
      this.text += c;
      this.i++;
    }
    this.flushText();
    return this.root.children;
  }

  openTag() {
    const markup = this.markup;
    const n = markup.length;
    let i = this.i + 1;
    const nameStart = i;
    while (i < n) {
      const c = markup.charAt(i);
      if (isWS(c) || c === ">" || c === "/") break;
      i++;
    }
    const el = new TplElement(this.normalizeName(markup.slice(nameStart, i)));
    let selfClosing = false;
    while (i < n) {
      while (i < n && isWS(markup.charAt(i))) i++;
      if (i >= n) break;
      const c = markup.charAt(i);
      if (c === ">") {
        i++;
        break;
      }
      if (c === "/") {
        if (markup.charAt(i + 1) === ">") {
          selfClosing = true;
          i += 2;
          break;
        }
        i++;
        continue;
      }
      const attrStart = i;
      while (i < n && !isWS(markup.charAt(i)) && markup.charAt(i) !== "=" && markup.charAt(i) !== ">" && !(markup.charAt(i) === "/" && markup.charAt(i + 1) === ">")) i++;
      const name = this.normalizeName(markup.slice(attrStart, i));
      let value = "";
      let j = i;
      while (j < n && isWS(markup.charAt(j))) j++;
      if (markup.charAt(j) === "=") {
        j++;
        while (j < n && isWS(markup.charAt(j))) j++;
        const q = markup.charAt(j);
        if (q === "\"" || q === "'") {
          const end = markup.indexOf(q, j + 1);
          value = end < 0 ? markup.slice(j + 1) : markup.slice(j + 1, end);
          j = end < 0 ? n : end + 1;
        } else {
          const valueStart = j;
          while (j < n && !isWS(markup.charAt(j)) && markup.charAt(j) !== ">") j++;
          value = markup.slice(valueStart, j);
        }
        i = j;
      }
      if (name === ELEMENT_MARKER) el.marked = true;
      else if (name.length > 0 && !el.attrs.has(name)) el.attrs.set(name, decodeEntities(value));
    }
    this.i = i;
    this.top().children.push(el);
    const tag = el.tag;
    if (this.html && VOID_TAGS.has(tag)) return;
    if (selfClosing && !this.html) return;
    if (this.rawTags.has(tag)) {
      this.rawText(el);
      return;
    }
    this.stack.push(el);
  }

  /** @param {TplElement} el */
  rawText(el) {
    const markup = this.markup;
    const n = markup.length;
    const lower = this.html ? markup.toLowerCase() : markup;
    let end = lower.indexOf("</" + el.tag, this.i);
    while (end >= 0) {
      const at = end + 2 + el.tag.length;
      if (at >= lower.length) break;
      const after = lower.charAt(at);
      if (after === ">" || isWS(after) || after === "/") break;
      end = lower.indexOf("</" + el.tag, end + 1);
    }
    const content = end < 0 ? markup.slice(this.i) : markup.slice(this.i, end);
    if (content.length > 0) el.children.push(new TplText(ESCAPABLE_RAW_TAGS.has(el.tag) ? decodeEntities(content) : content));
    if (end < 0) {
      this.i = n;
      return;
    }
    const close = markup.indexOf(">", end);
    this.i = close < 0 ? n : close + 1;
  }
}

/**
 * The template tree of `markup`: the top-level nodes, elements holding
 * their attributes (minus the `data-$$` marker, kept as `marked`), their
 * children and nothing else.
 * @param {string} markup
 * @param {number} kind HTML_KIND or SVG_KIND
 * @returns {TplNode[]}
 */
export const tokenize = (markup, kind) => new Tokenizer(markup, kind).run();

/**
 * The part specs of a template tree, each with the index of the node it
 * binds to: elements and comments counted in document order, the way a
 * browser's TreeWalker counts them, so a clone finds its targets by the
 * same walk.
 * @param {TplNode[]} tree
 * @param {ParsedPart[]} parts
 * @returns {PartSpec[]}
 */
export const indexParts = (tree, parts) => {
  /** @type {number[]} */
  const elIndex = [];
  /** @type {number[]} */
  const childIndex = [];
  let nodeIndex = -1;
  /** @param {TplNode[]} nodes */
  const visit = (nodes) => {
    for (const node of nodes)
      if (node instanceof TplElement) {
        nodeIndex++;
        if (node.marked) elIndex.push(nodeIndex);
        visit(node.children);
      } else if (node instanceof TplComment) {
        nodeIndex++;
        if (node.data === MARKER_START) childIndex.push(nodeIndex);
      }
  };
  visit(tree);
  /** @type {PartSpec[]} */
  const specs = [];
  for (const p of parts) {
    const nodeIndexOf = p.kind === "child" ? childIndex[p.childOrd ?? 0] : elIndex[p.elOrd ?? 0];
    specs.push({ kind: p.kind, valueIndex: p.valueIndex, valueCount: p.valueCount, name: p.name, statics: p.statics, elOrd: p.elOrd, childOrd: p.childOrd, nodeIndex: nodeIndexOf });
  }
  specs.sort(
    /**
     * @param {PartSpec} a
     * @param {PartSpec} b
     */
    (a, b) => a.nodeIndex - b.nodeIndex || a.valueIndex - b.valueIndex,
  );
  return specs;
};
