/**
 * @file The inline phase: the emphasis delimiter cases, code spans with backticks inside, escapes,
 * `~~del~~`, links and images with titles, reference links across a document (case-insensitive,
 * an undefined label left as text), autolinks before inline HTML, wiki links, and hard and soft
 * breaks.
 */
import {
  CodeSpan,
  Del,
  Em,
  FootnoteDefinition,
  FootnoteRef,
  Footnotes,
  HardBreak,
  Image,
  Inline,
  InlineHtml,
  Link,
  Paragraph,
  SoftBreak,
  Strong,
  Text,
  WikiLink,
  parse,
  parseInline,
  plainText,
} from "../index.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const show = (nodes: Inline[]): string => {
  let out = "";
  for (const node of nodes) {
    if (node instanceof Text) out += "T(" + node.text + ")";
    else if (node instanceof Strong) out += "Strong(" + show(node.children) + ")";
    else if (node instanceof Em) out += "Em(" + show(node.children) + ")";
    else if (node instanceof Del) out += "Del(" + show(node.children) + ")";
    else if (node instanceof CodeSpan) out += "Code(" + node.text + ")";
    else if (node instanceof FootnoteRef) out += "Note(" + node.label + "|" + node.number + ")";
    else if (node instanceof Link) out += "Link(" + node.href + "|" + node.title + "|" + show(node.children) + ")";
    else if (node instanceof Image) out += "Image(" + node.href + "|" + node.title + "|" + node.alt + ")";
    else if (node instanceof WikiLink) out += "Wiki(" + node.name + "|" + node.display + ")";
    else if (node instanceof InlineHtml) out += "Html(" + node.text + ")";
    else if (node instanceof HardBreak) out += "hard";
    else if (node instanceof SoftBreak) out += "soft";
  }
  return out;
};

eq("emphasis", show(parseInline("*a*")), "Em(T(a))");
eq("strong", show(parseInline("**a**")), "Strong(T(a))");
eq("strong inside emphasis", show(parseInline("***a***")), "Em(Strong(T(a)))");
eq("emphasis nested in strong", show(parseInline("**a *b* c**")), "Strong(T(a )Em(T(b))T( c))");
eq("emphasis within a word", show(parseInline("a*b*c")), "T(a)Em(T(b))T(c)");
eq("strong nested in emphasis", show(parseInline("*a **b** c*")), "Em(T(a )Strong(T(b))T( c))");
eq("an unmatched delimiter stays text", show(parseInline("*")), "T(*)");
eq("snake_case is not emphasis", plainText(parseInline("snake_case_word")), "snake_case_word");

eq("a code span with a backtick inside", show(parseInline("``a ` b``")), "Code(a ` b)");
eq("escapes", show(parseInline("\\*not em\\*")), "T(*not em*)");
eq("strikethrough", show(parseInline("~~gone~~")), "Del(T(gone))");

eq("an inline link with a title", show(parseInline("[text](/u \"T\")")), "Link(/u|T|T(text))");
eq("emphasis inside link text", show(parseInline("[**b**](/u)")), "Link(/u||Strong(T(b)))");
eq("an image with a title and a styled alt", show(parseInline("![alt *x*](/img \"T\")")), "Image(/img|T|alt x)");

eq("an inline code span in a link", show(parseInline("[`x`](/u)")), "Link(/u||Code(x))");

eq("a wiki link", show(parseInline("[[Page]]")), "Wiki(Page|Page)");
eq("a wiki link with a display", show(parseInline("[[Page|shown]]")), "Wiki(Page|shown)");

const scheme = show(parseInline("<https://example.com>"));
eq("a scheme autolink", scheme, "Link(https://example.com||T(https://example.com))");
eq("an email autolink", show(parseInline("<a@b.com>")), "Link(mailto:a@b.com||T(a@b.com))");
eq("inline HTML is not an autolink", show(parseInline("<span class=\"x\">")), "Html(<span class=\"x\">)");
eq("an inline comment", show(parseInline("<!-- hi -->")), "Html(<!-- hi -->)");

eq("a soft break", show(parseInline("a\nb")), "T(a)softT(b)");
eq("two trailing spaces make a hard break", show(parseInline("a  \nb")), "T(a)hardT(b)");
eq("a trailing backslash makes a hard break", show(parseInline("a\\\nb")), "T(a)hardT(b)");

const refs = parse("[a][X] [x][] [X]\n\n[x]: /url \"Title\"");
const first = refs[0];
ok("reference links leave their definitions out of the blocks", refs.length === 1 && first instanceof Paragraph);
if (first instanceof Paragraph) {
  eq(
    "references resolve, case-insensitively and with an empty label",
    show(first.children),
    "Link(/url|Title|T(a))T( )Link(/url|Title|T(x))T( )Link(/url|Title|T(X))",
  );
}

const undefinedRef = parse("[a][nope]")[0];
if (undefinedRef instanceof Paragraph) eq("an undefined reference stays text", show(undefinedRef.children), "T([a][nope])");

const notes = parse("first [^b] then [^a]\n\n[^a]: A\n\n[^b]: B\n\n[^c]: unused");
const notesParagraph = notes[0];
ok("footnote references number by first reference", notesParagraph instanceof Paragraph);
if (notesParagraph instanceof Paragraph) eq("their numbers", show(notesParagraph.children), "T(first )Note(b|1)T( then )Note(a|2)");
const notesBlock = notes[notes.length - 1];
ok("the referenced footnotes trail the document", notesBlock instanceof Footnotes);
if (notesBlock instanceof Footnotes) {
  eqn("only referenced definitions are kept", notesBlock.items.length, 2);
  eq("in reference order", notesBlock.items.map((item: FootnoteDefinition) => item.label + "|" + item.number).join(","), "b|1,a|2");
}

const undefinedNote = parse("[^nope]")[0];
if (undefinedNote instanceof Paragraph) eq("an undefined footnote reference stays text", show(undefinedNote.children), "T([^nope])");

const multiline = parse("[^a]\n\n[^a]: first\n    second")[0];
const multilineBlocks = parse("[^a]\n\n[^a]: first\n    second");
const multilineFootnotes = multilineBlocks[multilineBlocks.length - 1];
ok("a multi-line definition", multilineFootnotes instanceof Footnotes);
if (multilineFootnotes instanceof Footnotes && multilineFootnotes.items[0].blocks[0] instanceof Paragraph) {
  eq("keeps its continued text", plainText(multilineFootnotes.items[0].blocks[0].children), "first second");
}
ok("the reference is in the paragraph", multiline instanceof Paragraph);

eq("a URL drops trailing punctuation", show(parseInline("see https://a.b/x.")), "T(see )Link(https://a.b/x||T(https://a.b/x))T(.)");
eq("a URL drops a colon and a star", show(parseInline("https://a.b/x:*")), "Link(https://a.b/x||T(https://a.b/x))T(:)T(*)");
eq("a URL keeps a balanced parenthesis", show(parseInline("https://a.b/x_(y)")), "Link(https://a.b/x_(y)||T(https://a.b/x_(y)))");
eq("a URL drops an unbalanced closing parenthesis", show(parseInline("https://a.b/x(y))")), "Link(https://a.b/x(y)||T(https://a.b/x(y)))T())");
eq("a URL drops a trailing entity", show(parseInline("https://a.b/x&amp;")), "Link(https://a.b/x||T(https://a.b/x))T(&amp;)");
eq("www becomes an http URL", show(parseInline("www.example.com")), "Link(http://www.example.com||T(www.example.com))");
eq("an email becomes a mailto link", show(parseInline("a.b@host.tld")), "Link(mailto:a.b@host.tld||T(a.b@host.tld))");
eq("a URL inside a code span stays code", show(parseInline("`https://a.b`")), "Code(https://a.b)");
eq("a URL inside a link's text is not linked again", show(parseInline("[https://a.b](/x)")), "Link(/x||T(https://a.b))");

done();
