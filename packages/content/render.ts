/**
 * @file Draw a content body on the page as light's `html` template: no Markdown parser and no
 * `innerHTML`, headings with unique slug ids, links and images only through a safe address, raw
 * HTML escaped unless the app opts in, and `nodes` hooks that draw a node the app's own way.
 */

import { html, nothing, unsafeHTML } from "@lightstart/light/html";
import type { TemplateResult } from "@lightstart/light/html";
import { safeUrl } from "@lightstart/markdown/url.ts";
import type {
  ContentBlock,
  ContentFootnoteDefinition,
  ContentInline,
  ContentListItem,
} from "./json.ts";

/** Every node a hook may draw. */
export type ContentNode = ContentBlock | ContentInline | ContentFootnoteDefinition;

/** What `renderContent` reads besides the body. */
export interface RenderOptions {
  /** Whether raw HTML is written as markup; false (the default) escapes it as text. */
  html?: boolean;
  /** A draw for a node type, given the node instead of the default: `{ code: (node) => html`…` }`. */
  nodes?: Record<string, (node: ContentNode) => unknown>;
}

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createSlugger = (): ((text: string) => string) => {
  const seen = new Map<string, number>();
  return (text: string): string => {
    const base = slugify(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${String(count + 1)}`;
  };
};

const languageOf = (info: string): string => info.trim().split(/\s+/)[0] ?? "";

const draw = (
  node: ContentNode,
  options: RenderOptions,
  slug: (text: string) => string,
): unknown => {
  const hook = options.nodes?.[node.type];
  if (hook !== undefined) return hook(node);

  switch (node.type) {
    case "text":
      return node.text;
    case "strong":
      return html`<strong>${node.children.map((child) => draw(child, options, slug))}</strong>`;
    case "em":
      return html`<em>${node.children.map((child) => draw(child, options, slug))}</em>`;
    case "del":
      return html`<del>${node.children.map((child) => draw(child, options, slug))}</del>`;
    case "codeSpan":
      return html`<code>${node.text}</code>`;
    case "link":
      if (!safeUrl(node.href)) return node.children.map((child) => draw(child, options, slug));
      return node.title.length === 0
        ? html`<a href=${node.href}>${node.children.map((child) => draw(child, options, slug))}</a>`
        : html`<a href=${node.href} title=${node.title}>${node.children.map((child) => draw(child, options, slug))}</a>`;
    case "image":
      if (!safeUrl(node.href)) return node.alt;
      return node.title.length === 0
        ? html`<img src=${node.href} alt=${node.alt}>`
        : html`<img src=${node.href} alt=${node.alt} title=${node.title}>`;
    case "softBreak":
      return " ";
    case "hardBreak":
      return html`<br>`;
    case "wikiLink":
      return html`<a href=${`/wiki/${node.name}`} class="wiki-link">${node.display.length > 0 ? node.display : node.name}</a>`;
    case "footnoteRef":
      return html`<sup><a href=${`#fn-${node.label}`} id=${`fnref-${node.label}`}>${String(node.number)}</a></sup>`;
    case "inlineHtml":
      return options.html === true ? unsafeHTML(node.text) : node.text;
    case "heading": {
      const id = slug(node.text);
      const children = node.children.map((child) => draw(child, options, slug));
      if (node.level === 1) return html`<h1 id=${id}>${children}</h1>`;
      if (node.level === 2) return html`<h2 id=${id}>${children}</h2>`;
      if (node.level === 3) return html`<h3 id=${id}>${children}</h3>`;
      if (node.level === 4) return html`<h4 id=${id}>${children}</h4>`;
      if (node.level === 5) return html`<h5 id=${id}>${children}</h5>`;
      return html`<h6 id=${id}>${children}</h6>`;
    }
    case "paragraph":
      return html`<p>${node.children.map((child) => draw(child, options, slug))}</p>`;
    case "code": {
      const language = languageOf(node.info);
      return language.length === 0
        ? html`<pre><code>${node.text}</code></pre>`
        : html`<pre><code class=${`language-${language}`}>${node.text}</code></pre>`;
    }
    case "list":
      return drawList(node, options, slug);
    case "quote":
      return html`<blockquote>${node.blocks.map((block) => draw(block, options, slug))}</blockquote>`;
    case "rule":
      return html`<hr>`;
    case "table":
      return html`<table><thead><tr>${node.header.map((cell, index) => html`<th align=${node.aligns[index] ?? "left"}>${cell.map((child) => draw(child, options, slug))}</th>`)}</tr></thead><tbody>${node.rows.map((row) => html`<tr>${row.map((cell, index) => html`<td align=${node.aligns[index] ?? "left"}>${cell.map((child) => draw(child, options, slug))}</td>`)}</tr>`)}</tbody></table>`;
    case "html":
      return options.html === true ? unsafeHTML(node.text) : node.text;
    case "footnotes":
      return html`<section class="footnotes"><ol>${node.items.map((item) => draw(item, options, slug))}</ol></section>`;
    case "footnoteDefinition":
      return html`<li id=${`fn-${node.label}`}>${node.blocks.map((block) => draw(block, options, slug))}</li>`;
  }
  throw new Error("A content node of no known type cannot be drawn");
};

const drawItem = (item: ContentListItem, options: RenderOptions, slug: (text: string) => string): unknown => {
  const box = item.task
    ? item.checked
      ? html`<input type="checkbox" disabled checked> `
      : html`<input type="checkbox" disabled> `
    : nothing;
  return html`<li>${box}${item.blocks.map((block) => draw(block, options, slug))}</li>`;
};

const drawList = (node: Extract<ContentBlock, { type: "list" }>, options: RenderOptions, slug: (text: string) => string): unknown => {
  const items = node.items.map((item) => drawItem(item, options, slug));
  if (node.ordered) return node.start === 1 ? html`<ol>${items}</ol>` : html`<ol start=${node.start}>${items}</ol>`;
  return html`<ul>${items}</ul>`;
};

/** Draw a body's blocks as a light template, with one slugger shared by its headings. */
export const renderContent = (blocks: ContentBlock[], options: RenderOptions = {}): TemplateResult => {
  const slug = createSlugger();
  return html`${blocks.map((block) => draw(block, options, slug))}`;
};
