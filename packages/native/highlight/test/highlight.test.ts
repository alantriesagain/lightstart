/**
 * @file The code column's tokenizers against @bootstrapp/editor's own test cases (lang/*.test.js), one
 * letter per character as the editor's `annotate` paints them: the same JavaScript, CSS and HTML
 * sources must tokenize the same here, natively and under node. Plus TypeScript's keywords, the
 * language of a path or a fence, Markdown (block and inline marks, front matter, fences), and a
 * large file's time.
 */
import { HlState, languageForFence, languageForPath, tokenizeAll, tokenizeLine } from "../index.ts";
import { budget, done, eq, ok } from "@light/test/assert.ts";
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
]);

/** One letter per character of `source`, " " where no token covers it; lines joined by "\n". */
const annotate = (language: string, source: string): string => {
  const lines = source.split("\n");
  const tokens = tokenizeAll(language, lines);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells: string[] = [];
    for (let c = 0; c < lines[i].length; c++) cells.push(" ");
    for (const t of tokens[i]) for (let c = t.from; c < t.to; c++) cells[c] = LETTERS.get(t.type) ?? "?";
    out.push(cells.join(""));
  }
  return out.join("\n");
};

const cases = (language: string, list: string[][]): void => {
  for (const [source, expected] of list) eq(language + ": " + source.replace(/\n/g, "⏎"), annotate(language, source), expected);
};

cases("javascript", [
  ["const x = 1", "kkkkk d o n"],
  ["a = b / c / d", "v o v o v o v"],
  ["x = /[/]/g.test(s)", "v o rrrrrrpPPPPpvp"],
  ["return /re/i", "kkkkkk rrrrr"],
  ["`a${b + `c${d}`}e`", "ssppv o ssppvpspss"],
  ["`${ {a:1}.a }`", "spp pPonppP ps"],
  ["1_000n + .5e-3 + 0xFFn", "nnnnnn o nnnnn o nnnnn"],
  ['{ key: 1, "k2": 2 }', "p PPPo np PPPPo n p"],
  ["a ? b : c", "v o v o v"],
  ["obj.prop.deep", "vvvpPPPPpPPPP"],
  ["async function name(a) {}", "kkkkk kkkkkkkk ddddpvp pp"],
  ["class Foo extends Bar {}", "kkkkk ddd kkkkkkk vvv pp"],
  ["let s = 'it\\'s'", "kkk d o sssssss"],
  ["x = a?.b ?? c", "v o vooP oo v"],
  ["this.x = 1", "kkkkpP o n"],
  ["'unterminated", "sssssssssssss"],
  ["x = [1, 2].map((n) => n * 2)", "v o pnp nppPPPppvp oo v o np"],
  ['import { a } from "b";', "kkkkkk p v p kkkk sssp"],
  ["true && null", "AAAA oo AAAA"],
  ["typeof x === 'string'", "kkkkkk v ooo ssssssss"],
  ["x = y /* c */ / 2", "v o v ccccccc o n"],
  ["...rest", "ooovvvv"],
  ["/* multi\nline */ x", "cccccccc\nccccccc v"],
  ['"multi \\\nline"', "ssssssss\nsssss"],
  ["`a\n${b}\nc`", "ss\nppvp\nss"],
  ["// comment\nnext", "cccccccccc\nvvvv"],
  ['{\n  "a": [1, 2, {"b": null}]\n}', "p\n  PPPo pnp np pPPPo AAAApp\np"],
]);

cases("css", [
  ["a { color: red }", "t p PPPPPp     p"],
  [".card:hover > .title::before { --x: 1px; }", "aaaaakkkkkk o aaaaaakkkkkkkk p PPPp nnnp p"],
  ["@media (max-width: 600px) { .x { y: z } }", "mmmmmm pPPPPPPPPPp nnnnnp p aa p Pp   p p"],
  ['a{background:url("x.png") no-repeat}', "tpPPPPPPPPPPpvvvvsssssssp          p"],
  ["a{background:url(data:image/png;base64,ab==)}", "tpPPPPPPPPPPpvvvvsssssssssssssssssssssssssspp"],
  ["a{color:#fabd2f;margin:0 !important}", "tpPPPPPpAAAAAAApPPPPPPpn AAAAAAAAAAp"],
  ['a{content:"/* not a comment */"}', "tpPPPPPPPpsssssssssssssssssssssp"],
  ['a{grid-template-areas:"a b" "c d"}', "tpPPPPPPPPPPPPPPPPPPPpsssss sssssp"],
  ["a{font: 12px/1.5 sans-serif}", "tpPPPPp nnnnpnnn           p"],
  ["@import url(foo.css);", "mmmmmmm vvvpvvv vvvpp"],
  ['a[href^="http"] { }', "taaaaaaaaaaaaaa p p"],
  ["@keyframes spin { from { x: 0 } to { x: 1 } }", "mmmmmmmmmm vvvv p tttt p Pp n p tt p Pp n p p"],
  [".card {\n  &:hover { color: var(--brand); }\n  .title { font: 12px/1.5 sans-serif; }\n}", "aaaaa p\n  okkkkkk p PPPPPp vvvvvvvvvvvpp p\n  aaaaaa p PPPPp nnnnpnnn           p p\np"],
  ["h1, h2,\n.x {\n  margin: 0 !important;\n}", "ttp ttp\naa p\n  PPPPPPp n AAAAAAAAAAp\np"],
  ["/* real\ncomment */ a {}", "ccccccc\ncccccccccc t pp"],
]);

cases("html", [
  ['<div class="a" id=b>Hi &amp; bye</div>', "pttt aaaaaosss aaosp   eeeee    pptttp"],
  ["<script>let a = 1</script>", "pttttttpkkk d o nppttttttp"],
  ['<script type="text/template"><div></div></script>', "ptttttt aaaaosssssssssssssssp           ppttttttp"],
  ['<script type="module">import x from "y"</script>', "ptttttt aaaaosssssssspkkkkkk v kkkk sssppttttttp"],
  ["<style>a { color: red }</style>", "ptttttpt p PPPPPp     ppptttttp"],
  ["<!DOCTYPE html>", "mmmmmmmmmmmmmmm"],
  ['<a href="x>y" title=\'q\'>', "pt aaaaosssss aaaaaosssp"],
  ["<p>text</p>", "ptp    pptp"],
  ["<br/>", "pttpp"],
  ["<HTML>", "pttttp"],
  ["<!-- c\nomment --> <br/>", "cccccc\ncccccccccc pttpp"],
  ['<input value="multi\nline">', "pttttt aaaaaossssss\nsssssp"],
  ["<script>\nconst x = `a\n${1}`;\n</script>", "pttttttp\nkkkkk d o ss\nppnpsp\nppttttttp"],
  ['<style>\na::after { content: "</div>" }\n</style>', "ptttttp\ntkkkkkkk p PPPPPPPp ssssssss p\npptttttp"],
]);

cases("typescript", [
  ["interface Props { name: string }", "kkkkkkkkk ddddd p PPPPo vvvvvv p"],
  ["type Id = string | number;", "kkkk dd o vvvvvv o vvvvvvp"],
  ["private readonly x: number", "kkkkkkk kkkkkkkk vo vvvvvv"],
  ["const o = { type: 1 }", "kkkkk d o p PPPPo n p"],
]);

eq("languages by path", ["a.js", "b.TS", "c.json", "d.css", "e.html", "f.svg", "g.py", "Makefile"].map(languageForPath).join(","), "javascript,typescript,javascript,css,html,html,,");
eq("languages by fence", ["js", "TypeScript", "css {.x}", "html", "python", ""].map(languageForFence).join(","), "javascript,typescript,css,html,,");

const mdDoc = ["---", "title: Hello", "---", "# Heading one", "Some **bold**, *em*, snake_case_name, `code` and [a link](https://x.dev) or https://example.com.", "> a quote", "- [x] done item", "1. first", "| a | b |", "|---|:-:|", "```ts", "const x = 1;", "```", "~~~", "plain fenced", "~~~", "<div class=\"x\">html</div> \\*not em\\*", "***"];
const mdState = new HlState();
const md = mdDoc.map((line) => tokenizeLine("markdown", line, mdState).map((tk) => tk.type + ":" + line.slice(tk.from, tk.to)).join(" "));
eq("markdown: front matter", md.slice(0, 3).join(" | "), "meta:--- | property:title string: Hello | meta:---");
eq("markdown: a heading", md[3], "heading:# Heading one");
eq("markdown: inline marks; snake_case is not emphasis", md[4], "strong:**bold** emphasis:*em* string:`code` link:[a link] url:(https://x.dev) url:https://example.com");
eq("markdown: a quote, a task item, a numbered item, a table", [md[5], md[6], md[7], md[8], md[9]].join(" | "), "quote:> a quote | list:- atom:[x] | list:1. | meta:| meta:| meta:| | meta:|---|:-:|");
eq("markdown: a fence in its language", md.slice(10, 13).join(" | "), "meta:``` keyword:ts | keyword:const definition:x operator:= number:1 punctuation:; | meta:```");
eq("markdown: a fence without one, as code", md.slice(13, 16).join(" | "), "meta:~~~ | string:plain fenced | meta:~~~");
eq("markdown: tags, escapes, a rule", [md[16], md[17]].join(" | "), "tag:<div class=\"x\"> tag:</div> escape:\\* escape:\\* | meta:***");
eq("markdown files and fences", ["README.md", "notes.markdown", "page.mdx"].map(languageForPath).join(",") + " " + languageForFence("md"), "markdown,markdown,markdown markdown");

const big: string[] = [];
for (let i = 0; i < 20000; i++) big.push("export const value" + String(i) + " = { name: `item ${" + String(i) + "}`, size: " + String(i) + " * 2 }; // note");
const t0 = Date.now();
const tokens = tokenizeAll("typescript", big);
const ms = Date.now() - t0;
ok("20000 lines tokenized (" + String(tokens.length) + ")", tokens.length === 20000 && tokens[19999].length > 10);
ok("in under 2 s", ms < budget(2000));
done();
