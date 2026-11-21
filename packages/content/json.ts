/**
 * @file `@lightstart/markdown`'s class nodes as plain JSON, a `type` naming each one, so a
 * built page carries a body as data and draws it without the parser. Table cells become inline
 * node lists, so a cell keeps its emphasis, links and code.
 */

import { parseInline } from "@lightstart/markdown";
import {
  Code,
  CodeSpan,
  Del,
  Em,
  FootnoteDefinition,
  Footnotes,
  FootnoteRef,
  HardBreak,
  Heading,
  Html,
  Image,
  InlineHtml,
  Link,
  List,
  ListItem,
  Paragraph,
  Quote,
  Rule,
  SoftBreak,
  Strong,
  Table,
  Text,
  WikiLink,
} from "@lightstart/markdown";
import type { Block, Inline } from "@lightstart/markdown";

/** A plain-text inline. */
export interface ContentText {
  type: "text";
  text: string;
}

/** Strong emphasis around inline nodes. */
export interface ContentStrong {
  type: "strong";
  children: ContentInline[];
}

/** Emphasis around inline nodes. */
export interface ContentEm {
  type: "em";
  children: ContentInline[];
}

/** Strikethrough around inline nodes. */
export interface ContentDel {
  type: "del";
  children: ContentInline[];
}

/** A code span. */
export interface ContentCodeSpan {
  type: "codeSpan";
  text: string;
}

/** A link and its inline text. */
export interface ContentLink {
  type: "link";
  href: string;
  title: string;
  children: ContentInline[];
}

/** An image, its address, title and alt text. */
export interface ContentImage {
  type: "image";
  href: string;
  title: string;
  alt: string;
}

/** A soft line break. */
export interface ContentSoftBreak {
  type: "softBreak";
}

/** A hard line break. */
export interface ContentHardBreak {
  type: "hardBreak";
}

/** A wiki link. */
export interface ContentWikiLink {
  type: "wikiLink";
  name: string;
  display: string;
}

/** A footnote reference. */
export interface ContentFootnoteRef {
  type: "footnoteRef";
  label: string;
  number: number;
}

/** Raw inline HTML, kept as text. */
export interface ContentInlineHtml {
  type: "inlineHtml";
  text: string;
}

/** One inline node in a body. */
export type ContentInline =
  | ContentText
  | ContentStrong
  | ContentEm
  | ContentDel
  | ContentCodeSpan
  | ContentLink
  | ContentImage
  | ContentSoftBreak
  | ContentHardBreak
  | ContentWikiLink
  | ContentFootnoteRef
  | ContentInlineHtml;

/** A heading, with its id assigned when it is drawn. */
export interface ContentHeading {
  type: "heading";
  level: number;
  text: string;
  children: ContentInline[];
}

/** A paragraph. */
export interface ContentParagraph {
  type: "paragraph";
  children: ContentInline[];
}

/** A fenced or indented code block. */
export interface ContentCode {
  type: "code";
  info: string;
  text: string;
}

/** One list item, its blocks and whether it is a task. */
export interface ContentListItem {
  blocks: ContentBlock[];
  task: boolean;
  checked: boolean;
}

/** An ordered or unordered list. */
export interface ContentList {
  type: "list";
  ordered: boolean;
  start: number;
  items: ContentListItem[];
  loose: boolean;
}

/** A quote, holding blocks of its own. */
export interface ContentQuote {
  type: "quote";
  blocks: ContentBlock[];
}

/** A thematic break. */
export interface ContentRule {
  type: "rule";
}

/** A table whose header and body cells are inline node lists. */
export interface ContentTable {
  type: "table";
  header: ContentInline[][];
  aligns: ("left" | "center" | "right")[];
  rows: ContentInline[][][];
}

/** Raw HTML, kept as text. */
export interface ContentHtml {
  type: "html";
  text: string;
}

/** One footnote definition. */
export interface ContentFootnoteDefinition {
  type: "footnoteDefinition";
  label: string;
  number: number;
  blocks: ContentBlock[];
}

/** The document's referenced footnotes, last. */
export interface ContentFootnotes {
  type: "footnotes";
  items: ContentFootnoteDefinition[];
}

/** One block node in a body. */
export type ContentBlock =
  | ContentHeading
  | ContentParagraph
  | ContentCode
  | ContentList
  | ContentQuote
  | ContentRule
  | ContentTable
  | ContentHtml
  | ContentFootnotes;

/** Convert one inline node. */
export const inlineToJson = (node: Inline): ContentInline => {
  if (node instanceof Text) return { type: "text", text: node.text };
  if (node instanceof Strong) return { type: "strong", children: node.children.map(inlineToJson) };
  if (node instanceof Em) return { type: "em", children: node.children.map(inlineToJson) };
  if (node instanceof Del) return { type: "del", children: node.children.map(inlineToJson) };
  if (node instanceof CodeSpan) return { type: "codeSpan", text: node.text };
  if (node instanceof Link) return { type: "link", href: node.href, title: node.title, children: node.children.map(inlineToJson) };
  if (node instanceof Image) return { type: "image", href: node.href, title: node.title, alt: node.alt };
  if (node instanceof SoftBreak) return { type: "softBreak" };
  if (node instanceof HardBreak) return { type: "hardBreak" };
  if (node instanceof WikiLink) return { type: "wikiLink", name: node.name, display: node.display };
  if (node instanceof FootnoteRef) return { type: "footnoteRef", label: node.label, number: node.number };
  if (node instanceof InlineHtml) return { type: "inlineHtml", text: node.text };
  throw new Error("An inline node of no known type cannot become content JSON");
};

/** Convert a list of inline nodes. */
export const inlinesToJson = (nodes: Inline[]): ContentInline[] => nodes.map(inlineToJson);

const itemToJson = (item: ListItem): ContentListItem => ({
  blocks: item.blocks.map(blockToJson),
  task: item.task,
  checked: item.checked,
});

const footnoteToJson = (item: FootnoteDefinition): ContentFootnoteDefinition => ({
  type: "footnoteDefinition",
  label: item.label,
  number: item.number,
  blocks: item.blocks.map(blockToJson),
});

/** Convert one block node. */
export const blockToJson = (node: Block): ContentBlock => {
  if (node instanceof Heading) return { type: "heading", level: node.level, text: node.text, children: inlinesToJson(node.children) };
  if (node instanceof Paragraph) return { type: "paragraph", children: inlinesToJson(node.children) };
  if (node instanceof Code) return { type: "code", info: node.info, text: node.text };
  if (node instanceof List) return { type: "list", ordered: node.ordered, start: node.start, items: node.items.map(itemToJson), loose: node.loose };
  if (node instanceof Quote) return { type: "quote", blocks: node.blocks.map(blockToJson) };
  if (node instanceof Rule) return { type: "rule" };
  if (node instanceof Table) {
    return {
      type: "table",
      header: node.header.map((cell) => inlinesToJson(parseInline(cell))),
      aligns: [...node.aligns],
      rows: node.rows.map((row) => row.map((cell) => inlinesToJson(parseInline(cell)))),
    };
  }
  if (node instanceof Html) return { type: "html", text: node.text };
  if (node instanceof Footnotes) return { type: "footnotes", items: node.items.map(footnoteToJson) };
  throw new Error("A block node of no known type cannot become content JSON");
};

/** Convert a parsed body's blocks. */
export const blocksToJson = (blocks: Block[]): ContentBlock[] => blocks.map(blockToJson);
