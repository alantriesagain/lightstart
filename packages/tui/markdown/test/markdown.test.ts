/**
 * @file Markdown tables in the chat (conversation/table.ts): cells aligned in columns under a bold
 * header and a rule, numbers right-aligned and centered where the delimiter row says so, a table
 * wider than the pane narrowed with its widest cells wrapped onto more rows, more columns than the
 * width holds listed row by row, a bar in `code` or escaped kept in its cell, an indent kept on
 * every line, and a bar line with no delimiter row left as text.
 */
import { inline, renderMarkdown } from "../markdown.ts";
import { cells } from "../table.ts";
import { Line, Run } from "@bootstrapp/light/native/tui/lines.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const text = (lines: Line[]): string[] => lines.map((l) => l.runs.map((r) => r.text).join("").replace(/\s+$/, ""));
const table = "| Name | Count | Note |\n|---|---:|:---:|\n| alpha | 1 | first |\n| beta | 22 | second one |";

const wide = renderMarkdown("Before.\n" + table + "\nAfter.", 60, [], "");
eq(
  "wide enough: columns as wide as their widest cell, the header over a rule, numbers right, the note centered",
  text(wide).join("\n"),
  "Before.\nName  │ Count │    Note\n──────┼───────┼───────────\nalpha │     1 │   first\nbeta  │    22 │ second one\nAfter.",
);
ok("the header is bold, the bars dim", wide[1].runs[0].bold && wide[1].runs.some((r) => r.text === " │ " && r.fg === "gray"));

const narrow = text(renderMarkdown(table, 24, [], ""));
eq("narrowed to the pane: the widest column wraps its cell, the rest aligned under it", narrow.slice(3).join("\n"), "beta  │    22 │  second\n      │       │   one");
ok("a wrapped cell's extra row is marked as a continuation", renderMarkdown(table, 24, [], "")[4].wrapped);

const listed = text(renderMarkdown(table, 20, [], ""));
eq("too many columns for the width: each row as header and value lines, a rule between rows", listed.join("\n"), "Name : alpha\nCount: 1\nNote : first\n────────────────────\nName : beta\nCount: 22\nNote : second one");

const code = text(renderMarkdown("| a \\| b | `x|y` |\n|---|---|\n| 1 | 2 |", 40, [], ""));
eq("an escaped bar and a bar in code stay in their cells", code[0], "a | b │ x|y");
eq("a double-backtick span keeps its bar", cells("| a | ``x|y`` |").join("|"), "a|``x|y``");
const fenced = text(renderMarkdown("```\n" + "x".repeat(60) + "\n```", 20, [], ""));
ok("a fenced line longer than the pane ends with an ellipsis", fenced.some((l) => l.includes("…") && l.length <= 20));

const indented = renderMarkdown(table, 60, [new Run("  │ ", "gray")], "");
ok("every line keeps the indent, the rule included", indented.every((l) => l.runs[0].text === "  │ " && l.decor === 1));

const plain = text(renderMarkdown("| just | text |\nnot a table", 40, [], ""));
eq("a bar line with no delimiter row is text as written", plain.join("\n"), "| just | text |\nnot a table");

const blocks = text(renderMarkdown("# Title\n- one\n- two", 40, [], ""));
eq("headings and list items", blocks.join("|"), "Title|• one|• two");
const rich = inline("**bold** `code` *em*", "", false);
ok("inline bold, code and italic keep their runs", rich.some((r) => r.text === "bold" && r.bold) && rich.some((r) => r.text === "code" && r.fg.length > 0) && rich.some((r) => r.text === "em" && r.italic));

const ragged = text(renderMarkdown("| a | b |\n|---|---|\n| 1 |\n| 2 | 3 | 4 |", 40, [], ""));
eq("a short row is padded and a long one cut to the header's columns", ragged.slice(2).join("\n"), "1 │\n2 │ 3");

done();
