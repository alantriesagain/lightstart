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
import { done, eq, ok } from "@light/test/assert.ts";

const show = (nodes: Inline[]): string => {
  let out = "";
  for (const node of nodes) {
    if (node instanceof Text) out += "T(" + node.text + ")";
    else if (node instanceof Strong) out += "Strong(" + show(node.children) + ")";
    else if (node instanceof Em) out += "Em(" + show(node.children) + ")";
    else if (node instanceof Del) out += "Del(" + show(node.children) + ")";
    else if (node instanceof CodeSpan) out += "Code(" + node.text + ")";
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

done();
