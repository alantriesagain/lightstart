import { unsafeHTML } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { createSlugger } from "../utils/slug.js";
/** @import { MarkdownHeading, MarkedLike, Prop } from "../types.ts" */

/** @param {string} text */
const escapeAttribute = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** @type {Map<string, string>} */
const NAMED_ENTITIES = new Map([
  ["colon", ":"],
  ["tab", "\t"],
  ["newline", "\n"],
  ["amp", "&"],
  ["lpar", "("],
  ["rpar", ")"],
]);

/**
 * One character reference as its text, or the reference unchanged when it names no code point.
 * @param {string} digits
 * @param {number} radix
 * @param {string} fallback
 */
const codePoint = (digits, radix, fallback) => {
  const code = Number.parseInt(digits, radix);
  return Number.isSafeInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
};

/** @param {string} text */
const decodeEntitiesOnce = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex) => codePoint(hex, 16, entity))
    .replace(/&#([0-9]+);/g, (entity, decimal) => codePoint(decimal, 10, entity))
    .replace(/&([a-z][a-z0-9]+);/gi, (entity, name) => NAMED_ENTITIES.get(name.toLowerCase()) ?? entity);

/**
 * Decode what a browser would decode, so `java&#x09;script:` cannot hide a scheme.
 * @param {string} text
 */
const decodeEntities = (text) => {
  let decoded = text;
  for (let pass = 0; pass < 5; pass++) {
    const next = decodeEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
};

/**
 * Whether a href is relative or uses http, https or mailto. A colon after a
 * path, query or fragment delimiter is not a scheme.
 * @param {string} href
 */
const safeUrl = (href) => {
  const url = decodeEntities(href).replace(/[\u0000-\u0020\u007f]/g, "").toLowerCase();
  return !/^[a-z][a-z0-9+.-]*:/.test(url) || /^(https?|mailto):/.test(url);
};

/**
 * What one parse collects. `marked` is one module-wide instance and `parse`
 * is synchronous, so the component points this at its own record before
 * parsing and the renderers write into it.
 * @type {{ slug: (text: string) => string, headings: MarkdownHeading[], anchors: boolean, unsafeHtml: boolean }}
 */
let current = {
  slug: createSlugger(),
  headings: [],
  anchors: false,
  unsafeHtml: /** @type {boolean} */ (false),
};

const renderer = {
  /**
   * @this {{ parser: { parseInline: (tokens: unknown[]) => string } }}
   * @param {string | { depth: number, tokens: unknown[], text: string }} token a token from marked 5 on; before, the text, with the level and raw text after it
   * @param {number} [level]
   * @param {string} [raw]
   */
  heading(token, level, raw) {
    const depth = typeof token === "object" ? token.depth : (level ?? 1);
    const inner = typeof token === "object" ? this.parser.parseInline(token.tokens) : token;
    const text = typeof token === "object" ? token.text : (raw ?? token);
    const id = current.slug(text);
    current.headings.push({ id, text, level: depth });
    const anchor = current.anchors ? `<a class="anchor" href="#${id}" aria-label="${escapeAttribute(text)}">#</a>` : "";
    return `<h${depth} id="${id}">${inner}${anchor}</h${depth}>\n`;
  },
  /**
   * @param {string | { text: string, lang?: string }} token a token from marked 5 on; before, the code, with the info string after it
   * @param {string} [info]
   */
  code(token, info) {
    const text = typeof token === "object" ? token.text : token;
    const lang = typeof token === "object" ? token.lang : info;
    const language = (lang || "").split(/\s/)[0];
    return `<lc-code-block language="${escapeAttribute(language)}" code="${escapeAttribute(text)}"></lc-code-block>\n`;
  },
  /**
   * @param {{ text: string }} token
   */
  html(token) {
    if (current.unsafeHtml) return false;
    return escapeAttribute(token.text);
  },
  /**
   * @this {{ parser: { parseInline: (tokens: unknown[]) => string } }}
   * @param {{ href: string, text: string, tokens: unknown[] }} token
   */
  link(token) {
    if (safeUrl(token.href)) return false;
    return this.parser.parseInline(token.tokens);
  },
  /**
   * @param {{ href: string, text: string }} token
   */
  image(token) {
    if (safeUrl(token.href)) return false;
    return escapeAttribute(token.text);
  },
};

const MARKED = "marked";

/** @type {{ load: () => Promise<{ marked: MarkedLike }> }} */
const source = { load: () => import(MARKED) };

/**
 * Say where `marked` comes from. By default it is the bare `marked`
 * specifier, which the page's importmap resolves; with a bundler, pass
 * `load: () => import("marked")` so it sees the dependency.
 * @param {{ load: () => Promise<{ marked: MarkedLike }> }} options
 */
export const configureMarkdown = (options) => {
  Object.assign(source, options);
};

/** @type {Promise<MarkedLike> | null} */
let _markedPromise = null;
const loadMarked = () => {
  if (_markedPromise) return _markedPromise;
  _markedPromise = source.load().then(({ marked }) => {
    marked.use({
      renderer,
      extensions: [
        {
          name: "wikiLink",
          level: "inline",
          /** @param {string} src */
          start(src) {
            return src.match(/\[\[/)?.index;
          },
          /** @param {string} src */
          tokenizer(src) {
            const match = src.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
            if (match)
              return {
                type: "wikiLink",
                raw: match[0],
                name: match[1].trim(),
                display: (match[2] || match[1]).trim(),
              };
          },
          /** @param {{ name: string, display: string }} token */
          renderer(token) {
            return `<a class="wiki-link" data-name="${escapeAttribute(token.name)}">${escapeAttribute(token.display)}</a>`;
          },
        },
      ],
    });
    return marked;
  });
  return _markedPromise;
};

/**
 * Markdown Component
 *
 * @component
 * @category display
 * @tag lc-markdown
 *
 * Renders markdown through `marked`, styled by the theme's prose rules. Raw HTML in the
 * content shows as text unless `unsafeHtml` is set, which a caller does only for content
 * it trusts. Links keep only `http`, `https`, `mailto` and relative targets, in both modes.
 *
 * @example
 * ```html
 * <lc-markdown .content=${doc}></lc-markdown>
 * <lc-markdown anchors .content=${guide}></lc-markdown>
 * <lc-markdown .content=${trusted} .unsafeHtml=${true}></lc-markdown>
 * ```
 */
export default defineComponent({
  tag: "lc-markdown",
  style: true,
  props: {
    content: T.string(),
    anchors: T.boolean(),
    unsafeHtml: T.boolean({ attribute: false, defaultValue: false }),
    onWikiLink: T.function(),
    _marked: /** @type {Prop<MarkedLike | null>} */ (T.object({ attribute: false })),
    _headings: /** @type {Prop<MarkdownHeading[]>} */ (T.array({ attribute: false, defaultValue: [], reactive: false })),
    _announced: T.string({ defaultValue: "", reactive: false }),
  },
  events: {
    "markdown-rendered": T.object(),
  },

  connected() {
    const onWikiClick = /** @type {EventListener} */ ((e) => {
      const link = /** @type {HTMLElement | null} */ ((/** @type {HTMLElement} */ (e.target)).closest(".wiki-link"));
      if (link && this.onWikiLink) {
        e.preventDefault();
        this.onWikiLink(link.dataset.name);
      }
    });
    this.addEventListener("click", onWikiClick);
    this.$own(() => this.removeEventListener("click", onWikiClick));
    loadMarked().then((marked) => { this._marked = marked; });
  },

  updated() {
    if (!this._marked) return;
    const key = `${this.anchors}:${this.content || ""}`;
    if (key === this._announced) return;
    this._announced = key;
    this.$emit("markdown-rendered", { headings: this._headings });
  },

  render() {
    if (!this._marked) return "";
    current = { slug: createSlugger(), headings: [], anchors: this.anchors, unsafeHtml: !!this.unsafeHtml };
    const rendered = this._marked.parse(this.content || "");
    this._headings = current.headings;
    return unsafeHTML(rendered);
  },
});
