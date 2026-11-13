import { unsafeHTML } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import {
  Code,
  CodeSpan,
  Del,
  Em,
  HardBreak,
  Heading,
  Html,
  Image,
  InlineHtml,
  Link,
  List,
  Paragraph,
  Quote,
  Rule,
  SoftBreak,
  Strong,
  Table,
  Text,
  WikiLink,
  parse,
  parseInline,
  plainText,
  safeUrl,
} from "@lightstart/markdown";
import { createSlugger } from "../utils/slug.js";
/** @import { MarkdownHeading, Prop } from "../types.ts" */

/**
 * @typedef {import("@lightstart/markdown").Block} BlockNode
 * @typedef {import("@lightstart/markdown").Inline} InlineNode
 * @typedef {{ slug: (text: string) => string, headings: MarkdownHeading[], anchors: boolean, unsafeHtml: boolean }} RenderContext
 */

/** @param {string} text */
const escapeText = (text) =>
  text
    .replace(/&(?!(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** @param {string} text */
const escapeAttribute = (text) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * @param {InlineNode} node
 * @param {RenderContext} context
 * @returns {string}
 */
const renderInline = (node, context) => {
  if (node instanceof Text) return escapeText(node.text);
  if (node instanceof Strong) return `<strong>${renderInlines(node.children, context)}</strong>`;
  if (node instanceof Em) return `<em>${renderInlines(node.children, context)}</em>`;
  if (node instanceof Del) return `<del>${renderInlines(node.children, context)}</del>`;
  if (node instanceof CodeSpan) return `<code>${escapeText(node.text)}</code>`;
  if (node instanceof Link) {
    const children = renderInlines(node.children, context);
    if (!safeUrl(node.href)) return children;
    const title = node.title.length > 0 ? ` title="${escapeAttribute(node.title)}"` : "";
    return `<a href="${escapeAttribute(node.href)}"${title}>${children}</a>`;
  }
  if (node instanceof Image) {
    if (!safeUrl(node.href)) return escapeText(node.alt);
    const title = node.title.length > 0 ? ` title="${escapeAttribute(node.title)}"` : "";
    return `<img src="${escapeAttribute(node.href)}" alt="${escapeAttribute(node.alt)}"${title}>`;
  }
  if (node instanceof SoftBreak) return "\n";
  if (node instanceof HardBreak) return "<br>";
  if (node instanceof WikiLink) return `<a class="wiki-link" data-name="${escapeAttribute(node.name)}">${escapeText(node.display)}</a>`;
  if (node instanceof InlineHtml) return context.unsafeHtml ? node.text : escapeText(node.text);
  return "";
};

/**
 * @param {InlineNode[]} nodes
 * @param {RenderContext} context
 * @returns {string}
 */
const renderInlines = (nodes, context) => {
  let out = "";
  for (const node of nodes) out += renderInline(node, context);
  return out;
};

/**
 * @param {string} tag
 * @param {string} text
 * @param {string} align
 * @param {RenderContext} context
 * @returns {string}
 */
const renderCell = (tag, text, align, context) => {
  const attribute = align === "left" ? "" : ` align="${escapeAttribute(align)}"`;
  return `<${tag}${attribute}>${renderInlines(parseInline(text), context)}</${tag}>`;
};

/**
 * @param {Table} table
 * @param {RenderContext} context
 * @returns {string}
 */
const renderTable = (table, context) => {
  let out = "<table><thead><tr>";
  for (let i = 0; i < table.header.length; i++) out += renderCell("th", table.header[i], table.aligns[i], context);
  out += "</tr></thead><tbody>";
  for (const row of table.rows) {
    out += "<tr>";
    for (let i = 0; i < table.header.length; i++) out += renderCell("td", row[i], table.aligns[i], context);
    out += "</tr>";
  }
  return `${out}</tbody></table>`;
};

/**
 * @param {List} list
 * @param {RenderContext} context
 * @returns {string}
 */
const renderList = (list, context) => {
  const tag = list.ordered ? "ol" : "ul";
  const start = list.ordered && list.start !== 1 ? ` start="${escapeAttribute(String(list.start))}"` : "";
  let out = `<${tag}${start}>`;
  for (const item of list.items) {
    out += "<li>";
    if (item.task) out += `<input type="checkbox" disabled${item.checked ? " checked" : ""}> `;
    out += renderBlocks(item.blocks, context, !list.loose);
    out += "</li>";
  }
  return `${out}</${tag}>`;
};

/**
 * @param {Heading} heading
 * @param {RenderContext} context
 * @returns {string}
 */
const renderHeading = (heading, context) => {
  const text = plainText(heading.children);
  const id = context.slug(text);
  context.headings.push({ id, text, level: heading.level });
  const anchor = context.anchors
    ? `<a class="anchor" href="#${escapeAttribute(id)}" aria-label="${escapeAttribute(text)}">#</a>`
    : "";
  return `<h${heading.level} id="${escapeAttribute(id)}">${renderInlines(heading.children, context)}${anchor}</h${heading.level}>`;
};

/**
 * @param {BlockNode} block
 * @param {RenderContext} context
 * @param {boolean} tight
 * @returns {string}
 */
const renderBlock = (block, context, tight) => {
  if (block instanceof Heading) return renderHeading(block, context);
  if (block instanceof Paragraph) {
    const children = renderInlines(block.children, context);
    return tight ? children : `<p>${children}</p>`;
  }
  if (block instanceof Code) {
    const language = block.info.split(/\s/)[0];
    return `<lc-code-block language="${escapeAttribute(language)}" code="${escapeAttribute(block.text)}"></lc-code-block>`;
  }
  if (block instanceof List) return renderList(block, context);
  if (block instanceof Quote) return `<blockquote>${renderBlocks(block.blocks, context, false)}</blockquote>`;
  if (block instanceof Rule) return "<hr>";
  if (block instanceof Table) return renderTable(block, context);
  if (block instanceof Html) return context.unsafeHtml ? block.text : `<p>${escapeText(block.text)}</p>`;
  return "";
};

/**
 * @param {BlockNode[]} blocks
 * @param {RenderContext} context
 * @param {boolean} tight
 * @returns {string}
 */
const renderBlocks = (blocks, context, tight) => {
  /** @type {string[]} */
  const parts = [];
  for (const block of blocks) parts.push(renderBlock(block, context, tight));
  return parts.join("\n");
};

/**
 * @param {BlockNode[]} blocks
 * @param {RenderContext} context
 * @returns {string}
 */
const toHtml = (blocks, context) => renderBlocks(blocks, context, false);

/**
 * Markdown Component
 *
 * @component
 * @category display
 * @tag lc-markdown
 *
 * Renders markdown with `@lightstart/markdown`, styled by the theme's prose rules. Raw HTML in
 * the content shows as text unless `unsafeHtml` is set, which a caller does only for content it
 * trusts. Links keep only `http`, `https`, `mailto` and relative targets, in both modes.
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
  },

  updated() {
    const key = `${this.anchors}:${this.content || ""}`;
    if (key === this._announced) return;
    this._announced = key;
    this.$emit("markdown-rendered", { headings: this._headings });
  },

  render() {
    /** @type {RenderContext} */
    const context = { slug: createSlugger(), headings: [], anchors: !!this.anchors, unsafeHtml: !!this.unsafeHtml };
    const rendered = toHtml(parse(this.content || ""), context);
    this._headings = context.headings;
    return unsafeHTML(rendered);
  },
});
