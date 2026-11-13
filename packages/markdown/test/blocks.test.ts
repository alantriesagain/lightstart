/**
 * @file The block phase: each block kind, nesting of quotes and lists (three list levels, a task
 * list), lazy continuation, fenced code in tildes, longer fences, info strings and an unclosed
 * fence, an HTML block that ends at a blank line, and tables with alignments, `\|` and bars in
 * code.
 */
import {
  Code,
  Heading,
  Html,
  List,
  Paragraph,
  Quote,
  Rule,
  Table,
  parse,
} from "../index.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const doc = parse("# Title\n\nA *b*.\n\n> quote\n\n- one\n- two\n\n1. a\n2. b\n\n---\n\n```js\nx = 1\n```");
eqn("the document has every block kind once", doc.length, 7);
ok("a heading", doc[0] instanceof Heading);
if (doc[0] instanceof Heading) {
  eqn("heading level", doc[0].level, 1);
  eq("heading plain text", doc[0].text, "Title");
}
ok("a paragraph", doc[1] instanceof Paragraph);
ok("a quote", doc[2] instanceof Quote);
ok("an unordered list", doc[3] instanceof List);
if (doc[3] instanceof List) {
  ok("with two items", doc[3].items.length === 2);
  ok("the first item has a paragraph", doc[3].items[0].blocks[0] instanceof Paragraph);
}
ok("an ordered list", doc[4] instanceof List);
if (doc[4] instanceof List) {
  ok("ordered, from 1", doc[4].ordered && doc[4].start === 1);
}
ok("a rule", doc[5] instanceof Rule);
ok("a code block", doc[6] instanceof Code);
if (doc[6] instanceof Code) {
  eq("the fence's info", doc[6].info, "js");
  eq("the code's text", doc[6].text, "x = 1");
}

const ordered = parse("3. a\n4. b")[0];
if (ordered instanceof List) eqn("an ordered list starts at its first item", ordered.start, 3);

const tilde = parse("~~~python\nprint(1)\n~~~")[0];
if (tilde instanceof Code) eq("tildes fence and name a language", tilde.info + "|" + tilde.text, "python|print(1)");

const nestedFence = parse("````\na\n```\nb\n````")[0];
if (nestedFence instanceof Code) eq("a closing fence shorter than the opening does not close", nestedFence.text, "a\n```\nb");

const info = parse("```js title\nx\n```")[0];
if (info instanceof Code) eq("the info string is whole", info.info, "js title");

const unclosed = parse("```\na\nb")[0];
if (unclosed instanceof Code) eq("an unclosed fence runs to the end", unclosed.text, "a\nb");

const quotedList = parse("> - a\n> - b")[0];
ok("a list inside a quote", quotedList instanceof Quote && quotedList.blocks[0] instanceof List);

const listQuote = parse("- > q")[0];
if (listQuote instanceof List) {
  const block = listQuote.items[0].blocks[0];
  ok("a quote inside a list item", block instanceof Quote);
  if (block instanceof Quote) {
    const inner = block.blocks[0];
    ok("its paragraph", inner instanceof Paragraph);
  }
}

const deep = parse("- a\n  - b\n    - c")[0];
ok("three list levels", deep instanceof List);
if (deep instanceof List) {
  const second = deep.items[0].blocks[1];
  ok("the second level", second instanceof List);
  if (second instanceof List) ok("the third level", second.items[0].blocks[1] instanceof List);
}

const tasks = parse("- [ ] todo\n- [x] done")[0];
if (tasks instanceof List) {
  ok("task items", tasks.items[0].task && tasks.items[1].task);
  ok("checked and unchecked", !tasks.items[0].checked && tasks.items[1].checked);
}

const lazyQuote = parse("> a\nb")[0];
ok("lazy continuation in a quote", lazyQuote instanceof Quote && lazyQuote.blocks[0] instanceof Paragraph);

const lazyList = parse("- a\nb")[0];
ok("lazy continuation in a list item", lazyList instanceof List && lazyList.items[0].blocks[0] instanceof Paragraph);

const html = parse("<details>\n<summary>S</summary>\n\nA *b*.\n\n</details>");
eqn("an HTML block, a paragraph and another HTML block", html.length, 3);
ok("HTML first", html[0] instanceof Html);
ok("markdown after it", html[1] instanceof Paragraph);
ok("HTML last", html[2] instanceof Html);
if (html[0] instanceof Html) eq("HTML ends at the blank line", html[0].text, "<details>\n<summary>S</summary>");

const table = parse("| Name | Count |\n|:---|---:|\n| a | 1 |\n| b | 2 |")[0];
ok("a table", table instanceof Table);
if (table instanceof Table) {
  eq("header cells", table.header.join(","), "Name,Count");
  eq("alignments", table.aligns.join(","), "left,right");
  eq("rows", table.rows.map((r: string[]) => r.join(":")).join("|"), "a:1|b:2");
}

const escaped = parse("| a \\| b | `x|y` |\n|---|---|\n| 1 | 2 |")[0];
ok("a table with an escaped bar and a bar in code", escaped instanceof Table);
if (escaped instanceof Table) {
  eq("an escaped bar stays in its cell", escaped.header[0], "a | b");
  eq("a bar in code stays in its cell", escaped.header[1], "`x|y`");
}

done();
