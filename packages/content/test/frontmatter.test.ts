/**
 * @file The frontmatter subset: scalars, inline lists, block lists of scalars and of flat maps,
 * `|` strings, a body after the closing fence, no frontmatter at all, and an unreadable line
 * named by its number.
 */

import { done, eq, eqn, ok, throws } from "@lightstart/test/assert.ts";
import { parseFrontmatter } from "../frontmatter.ts";

const scalars = parseFrontmatter('---\ntitle: "Hello: world"\ncount: 3\nratio: 1.5\nactive: true\noff: false\nmissing: null\nbare: plain text\nquoted: \'it\'\'s\'\n---\nBody\n');
eq("a quoted string keeps its colon", String(scalars.data["title"]), "Hello: world");
eqn("a number", scalars.data["count"] as number, 3);
eqn("a decimal", scalars.data["ratio"] as number, 1.5);
ok("true", scalars.data["active"] === true);
ok("false", scalars.data["off"] === false);
ok("null", scalars.data["missing"] === null);
eq("a bare string", String(scalars.data["bare"]), "plain text");
eq("a single-quoted string unescapes a quote", String(scalars.data["quoted"]), "it's");
eq("the body follows the closing fence", scalars.body, "Body\n");

const inline = parseFrontmatter("---\ntags: [one, two, \"three\"]\n---\n");
ok("an inline list is an array", Array.isArray(inline.data["tags"]));
eq("an inline list's items", JSON.stringify(inline.data["tags"]), JSON.stringify(["one", "two", "three"]));

const block = parseFrontmatter("---\ntags:\n  - one\n  - two\n---\n");
eq("a block list of scalars", JSON.stringify(block.data["tags"]), JSON.stringify(["one", "two"]));

const maps = parseFrontmatter("---\nperiods:\n  - period: 2024\n    title: First\n  - period: 2025\n    title: Second\n---\n");
eq(
  "a block list of flat maps",
  JSON.stringify(maps.data["periods"]),
  JSON.stringify([{ period: 2024, title: "First" }, { period: 2025, title: "Second" }]),
);

const literal = parseFrontmatter("---\nsummary: |\n  first line\n    indented\n\n  last line\n---\n");
eq("a | string keeps its lines and drops the common indent", String(literal.data["summary"]), "first line\n  indented\n\nlast line");

const plain = parseFrontmatter("# A title\n\nA body.\n");
eqn("a file with no frontmatter has no data", Object.keys(plain.data).length, 0);
eq("a file with no frontmatter keeps its whole body", plain.body, "# A title\n\nA body.\n");

throws("an unreadable line is named by its number", () => parseFrontmatter("---\ntitle: ok\nnot a key line\n---\n"), "line 3");
done();
