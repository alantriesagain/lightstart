/**
 * @file A parsed document as plain JSON: every block and inline type, table header and cells
 * as inline node lists, and the trailing footnotes.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { parse } from "@lightstart/markdown";
import { blocksToJson } from "../json.ts";
import type { ContentBlock, ContentInline } from "../json.ts";

const source = [
  "# Title *em*",
  "",
  "Text **strong** *em* ~~del~~ `code` [link](https://example.com) ![alt](https://x.test/p.png) [[Wiki|shown]] [^1] <span>inline</span>",
  "soft",
  "hard  ",
  "next",
  "",
  "```js",
  "x = 1",
  "```",
  "",
  "- [x] done",
  "- plain",
  "",
  "> quote",
  "",
  "---",
  "",
  "| Left | Center |",
  "| :--- | :---: |",
  "| **bold** | `cell` |",
  "",
  "<div>raw</div>",
  "",
  "[^1]: note",
].join("\n");

const body = blocksToJson(parse(source));
const blockTypes = body.map((block) => block.type);
eq(
  "every block type is named",
  blockTypes.join(","),
  "heading,paragraph,code,list,quote,rule,table,html,footnotes",
);

const inlineTypes: string[] = [];
const collect = (nodes: ContentInline[]): void => {
  for (const node of nodes) {
    inlineTypes.push(node.type);
    if ("children" in node) collect(node.children);
  }
};

for (const block of body) {
  if (block.type === "heading" || block.type === "paragraph") collect(block.children);
  if (block.type === "list") for (const item of block.items) for (const child of item.blocks as ContentBlock[]) if (child.type === "paragraph") collect(child.children);
  if (block.type === "quote") for (const child of block.blocks) if (child.type === "paragraph") collect(child.children);
  if (block.type === "table") {
    for (const cell of block.header) collect(cell);
    for (const row of block.rows) for (const cell of row) collect(cell);
  }
  if (block.type === "footnotes") for (const item of block.items) for (const child of item.blocks) if (child.type === "paragraph") collect(child.children);
}

for (const type of ["text", "strong", "em", "del", "codeSpan", "link", "image", "wikiLink", "footnoteRef", "inlineHtml", "softBreak", "hardBreak"]) {
  ok(`an inline ${type} is kept`, inlineTypes.includes(type));
}

const heading = body[0];
ok("a heading keeps its level and plain text", heading?.type === "heading" && heading.level === 1 && heading.text === "Title em");

const table = body[6];
ok("a table", table?.type === "table" && table.rows.length === 1);
if (table?.type === "table") {
  eq("its header cells are inline lists", table.header[0]?.map((node) => node.type).join(",") ?? "", "text");
  eq("a header alignment", table.aligns.join(","), "left,center");
  eq("a body cell keeps its emphasis", table.rows[0]?.[0]?.map((node) => node.type).join(",") ?? "", "strong");
}

const footnotes = body[8];
if (footnotes?.type === "footnotes") {
  eq("the footnote is numbered", String(footnotes.items[0]?.number), "1");
  eq("and its body is a block", footnotes.items[0]?.blocks[0]?.type ?? "", "paragraph");
} else {
  ok("the footnote block is last", false);
}

const list = body[3];
if (list?.type === "list") ok("a task item keeps its check", list.items[0]?.task === true && list.items[0]?.checked === true);
else ok("a task item keeps its check", false);

done();
