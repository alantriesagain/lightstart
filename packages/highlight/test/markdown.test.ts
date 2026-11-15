/**
 * @file Markdown against @bootstrapp/editor's own test cases (lang/markdown.test.js), one letter per
 * character as the editor's `annotate` paints them, plus the block, quote and inline structure the
 * tokenizer answers beside its tokens. Runs the same under node and scriptc.
 */
import { FenceState, TableState } from "../state.ts";
import { HlState, LineResult, MdBlock, MdSpan, Range, tokenizeAll, tokenizeLineWithStructure } from "../index.ts";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { registerLanguages } from "../languages.ts";

registerLanguages();

const LETTERS = new Map<string, string>([
  ["keyword", "k"],
  ["string", "s"],
  ["comment", "c"],
  ["number", "n"],
  ["operator", "o"],
  ["punctuation", "p"],
  ["property", "P"],
  ["tag", "t"],
  ["attribute", "a"],
  ["variable", "v"],
  ["definition", "d"],
  ["regexp", "r"],
  ["escape", "e"],
  ["meta", "m"],
  ["atom", "A"],
  ["heading", "h"],
  ["emphasis", "i"],
  ["strong", "b"],
  ["strikethrough", "x"],
  ["link", "l"],
  ["url", "u"],
  ["code", "`"],
  ["quote", "q"],
  ["list", "L"],
  ["hr", "-"],
  ["table", "T"],
]);

const structure = (source: string): LineResult[] => {
  const lines = source.split("\n");
  const state = new HlState();
  const out: LineResult[] = [];
  for (let i = 0; i < lines.length; i++) out.push(tokenizeLineWithStructure("markdown", lines[i], state, (offset: number): string | null => (i + offset >= 0 && i + offset < lines.length ? lines[i + offset] : null)));
  return out;
};

const paint = (length: number, tokens: LineResult["tokens"], letter: (type: string, mark: boolean) => string): string => {
  const cells: string[] = [];
  for (let c = 0; c < length; c++) cells.push(" ");
  for (const t of tokens) for (let c = t.from; c < Math.min(t.to, length); c++) cells[c] = letter(t.type, t.mark);
  return cells.join("");
};

const annotate = (source: string): string => {
  const lines = source.split("\n");
  return structure(source)
    .map((r, i) => paint(lines[i].length, r.tokens, (type: string) => LETTERS.get(type) ?? "?"))
    .join("\n");
};

const marks = (source: string): string => {
  const lines = source.split("\n");
  return structure(source)
    .map((r, i) => paint(lines[i].length, r.tokens.filter((t) => t.mark), () => "^"))
    .join("\n");
};

const blockOf = (r: LineResult): MdBlock => {
  const md = r.md;
  if (md === null) throw new Error("expected Markdown structure");
  return md.block;
};

const spansOf = (r: LineResult): MdSpan[] => {
  const md = r.md;
  if (md === null) throw new Error("expected Markdown structure");
  return md.spans;
};

const findSpan = (spans: MdSpan[], type: string): MdSpan | null => {
  for (const s of spans) if (s.type === type) return s;
  return null;
};

const rangeJson = (r: Range | null): string => (r === null ? "null" : '{"from":' + String(r.from) + ',"to":' + String(r.to) + "}");

const blockJson = (b: MdBlock): string => {
  switch (b.kind) {
    case "heading":
      return '{"kind":"heading","level":' + String(b.level) + ',"mark":' + rangeJson(b.mark) + "}";
    case "setext":
      return '{"kind":"setext","level":' + String(b.level) + "}";
    case "fence":
      return '{"kind":"fence","edge":' + JSON.stringify(b.edge) + ',"lang":' + JSON.stringify(b.lang) + "}";
    case "list":
      return (
        '{"kind":"list","ordered":' +
        String(b.ordered) +
        ',"task":' +
        String(b.task) +
        ',"mark":' +
        rangeJson(b.mark) +
        ',"checkbox":' +
        rangeJson(b.checkbox) +
        ',"indent":' +
        String(b.indent) +
        "}"
      );
    case "table": {
      const cells: string[] = [];
      for (const c of b.cells) cells.push(rangeJson(c));
      return '{"kind":"table","row":' + JSON.stringify(b.row) + ',"cells":[' + cells.join(",") + "]}";
    }
    default:
      return '{"kind":' + JSON.stringify(b.kind) + "}";
  }
};

const spanJson = (s: MdSpan): string => {
  let out = '{"type":' + JSON.stringify(s.type) + ',"from":' + String(s.from) + ',"to":' + String(s.to) + ',"open":' + rangeJson(s.open) + ',"close":' + rangeJson(s.close);
  if (s.url.length > 0) out += ',"url":' + JSON.stringify(s.url);
  if (s.name.length > 0) out += ',"name":' + JSON.stringify(s.name);
  if (s.display.length > 0) out += ',"display":' + JSON.stringify(s.display);
  return out + "}";
};

const cases = [
  ["# Heading *one* #", "hhhhhhhhhhiiiiihh", "^^        ^   ^^^"],
  ["**bold *em* bold** and __u__", "bbbbbbbiiiibbbbbbb     bbbbb", "^^     ^  ^     ^^     ^^ ^^"],
  ["***both*** ~~gone~~", "ibbbbbbbbi xxxxxxxx", "^^^    ^^^ ^^    ^^"],
  ["*a **b** c*", "iiibbbbbiii", "^  ^^ ^^  ^"],
  ["snake_case_word * not em *", "                          ", "                          "],
  ["__init__ and _em_ and a_b_c", "bbbbbbbb     iiii          ", "^^    ^^     ^  ^          "],
  ["a `code *x*` b ``c ` d``", "  ``````````   `````````", "  ^        ^   ^^     ^^"],
  ['[a](b "t") and [[c|d]] ![i](s)', "llllulllll     lllllll lllllul", "^ ^^^^^^^^     ^^   ^^ ^^ ^^^^"],
  ["#tag vs a#b <https://x.y> https://z.w/p?q=1", "mmmm        uuuuuuuuuuuuu uuuuuuuuuuuuuuuuu", "            ^           ^                  "],
  ["<b>html</b> \\*escaped\\*", "ttt    tttt ee       ee", "            ^^       ^^"],
];

for (const [source, expected, expectedMarks] of cases) {
  eq("markdown: " + source, annotate(source), expected);
  eq("markdown marks: " + source, marks(source), expectedMarks);
}

eq("blocks: a heading and a setext", annotate("Title\n==="), "     \nhhh");
eq("blocks: a setext underline", annotate("text\n---"), "    \nhhh");
eq("blocks: a rule after a blank line", annotate("\n---"), "\n---");
eq("blocks: lists and tasks", annotate("- [ ] task\n1) item\n  * nested"), "LLLLL     \nLLL    \n  LL      ");
eq("blocks: a task's mark", marks("- [ ] task"), "^^        ");
eq("blocks: quotes", annotate("> # h1\n> - item\n> > deep"), "qqhhhh\nqqLL    \nqqqq    ");
eq("blocks: indented code", annotate("    indented code\npara\n    not code"), "`````````````````\n    \n            ");

eq(
  "blocks: every kind",
  structure("# H\nText\n---\n\n***\n- [x] done\n1. one\n> q")
    .map((r) => blockJson(blockOf(r)))
    .join("|"),
  [
    '{"kind":"heading","level":1,"mark":{"from":0,"to":2}}',
    '{"kind":"paragraph"}',
    '{"kind":"setext","level":2}',
    '{"kind":"blank"}',
    '{"kind":"hr"}',
    '{"kind":"list","ordered":false,"task":true,"mark":{"from":0,"to":2},"checkbox":{"from":2,"to":5},"indent":0}',
    '{"kind":"list","ordered":true,"task":null,"mark":{"from":0,"to":3},"checkbox":null,"indent":0}',
    '{"kind":"paragraph"}',
  ].join("|"),
);

const quoted = structure("> > deep")[0];
const quotedMd = quoted.md;
ok("a quote's depth is 2", quotedMd !== null && quotedMd.quote.depth === 2);
eq("a quote's marks", quotedMd === null ? "" : quotedMd.quote.marks.map((r) => rangeJson(r)).join(","), '{"from":0,"to":2},{"from":2,"to":4}');

const tableText = "| a | b |\n|---|:-:|\n| 1 | 2 |\ntext";
eq("tables: annotated through the delimiter row", annotate(tableText), "T   T   T\nTTTTTTTTT\nT   T   T\n    ");
eq(
  "tables: rows and cells",
  structure(tableText)
    .map((r) => blockJson(blockOf(r)))
    .join("|"),
  [
    '{"kind":"table","row":"header","cells":[{"from":1,"to":4},{"from":5,"to":8}]}',
    '{"kind":"table","row":"delimiter","cells":[{"from":1,"to":4},{"from":5,"to":8}]}',
    '{"kind":"table","row":"body","cells":[{"from":1,"to":4},{"from":5,"to":8}]}',
    '{"kind":"paragraph"}',
  ].join("|"),
);
eq("tables: a header without a delimiter row is a paragraph", blockJson(blockOf(structure("| a | b |\nnot a table")[0])), '{"kind":"paragraph"}');

eq("fences: a registered language", annotate("```js\nconst x = 1;\n```\nafter"), "```mm\nkkkkk d o np\n```\n     ");
eq("fences: quoted css", annotate("> ```css\n> a{color:red}\n> ```"), "qq```mmm\nqqtpPPPPPp   p\nqq```");
eq("fences: only the same marker closes", annotate("~~~\n``` not closing\n~~~"), "```\n```````````````\n```");
eq("fences: a longer fence is not closed by a shorter one", annotate("````\n```\n````"), "````\n```\n````");
eq(
  "fences: open, body and close",
  structure("```html\n<b>x</b>\n```")
    .map((r) => blockJson(blockOf(r)))
    .join("|"),
  ['{"kind":"fence","edge":"open","lang":"html"}', '{"kind":"fence","edge":null,"lang":"html"}', '{"kind":"fence","edge":"close","lang":"html"}'].join("|"),
);
const fenceLines = ["```html", "<b>x</b>", "```"];
const fenceState = new HlState();
const noPeek = (_offset: number): string | null => null;
tokenizeLineWithStructure("markdown", fenceLines[0], fenceState, noPeek);
ok("an opening fence leaves the fence open", fenceState.fence !== null);
tokenizeLineWithStructure("markdown", fenceLines[1], fenceState, noPeek);
tokenizeLineWithStructure("markdown", fenceLines[2], fenceState, noPeek);
ok("a closed fence leaves no fence state", fenceState.fence === null);
const plain = new HlState();
const fenced = plain.clone();
fenced.fence = new FenceState("`", 3, "", "", null, 0);
ok("an open fence alone makes a state unequal", !fenced.equals(plain) && !plain.equals(fenced));
const otherFence = plain.clone();
otherFence.fence = new FenceState("~", 3, "", "", null, 0);
ok("a fence's marker alone makes it unequal", !otherFence.equals(fenced));
const tabled = plain.clone();
tabled.table = new TableState(2);
ok("an open table alone makes a state unequal", !tabled.equals(plain) && !plain.equals(tabled));
const wider = plain.clone();
wider.table = new TableState(3);
ok("a table's column count alone makes it unequal", !wider.equals(tabled));

const spans = spansOf(structure("**bold *em* bold** [l](u) [[w|d]] #t")[0]);
const strong = findSpan(spans, "strong");
const emphasis = findSpan(spans, "emphasis");
const link = findSpan(spans, "link");
const wiki = findSpan(spans, "wiki");
const tag = findSpan(spans, "tag");
eq("a strong span", strong === null ? "" : spanJson(strong), '{"type":"strong","from":0,"to":18,"open":{"from":0,"to":2},"close":{"from":16,"to":18}}');
eq("an emphasis span", emphasis === null ? "" : spanJson(emphasis), '{"type":"emphasis","from":7,"to":11,"open":{"from":7,"to":8},"close":{"from":10,"to":11}}');
eq("a link's target", link === null ? "" : link.url, "u");
eq("a wiki link's name and display", wiki === null ? "" : wiki.name + "/" + wiki.display, "w/d");
eq("a tag's name", tag === null ? "" : tag.name, "t");

const state = new HlState();
tokenizeLineWithStructure("markdown", "| a | b |", state, (_offset: number): string | null => "|---|:-:|");
ok("a table header opens table state", state.table !== null && state.table.columns === 2);
const tokens = tokenizeAll("markdown", ["| a | b |", "|---|:-:|"]);
ok("tokenizeAll peeks at the delimiter row", tokens[0].some((t) => t.type === "table"));

const noMd = tokenizeLineWithStructure("javascript", "const x = 1", new HlState(), (_offset: number): string | null => null);
ok("another language has no Markdown structure", noMd.md === null && noMd.tokens.length > 0);

done();
