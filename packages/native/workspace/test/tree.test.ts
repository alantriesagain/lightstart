/**
 * @file The files column's model: status letters, nesting, sorting, expansion, the changed-only view.
 */
import { GitEntry } from "../git.ts";
import { ancestors, buildTree, changedDirs, markOf, marksOf, visibleRows } from "../tree.ts";
import { done, eq } from "@light/test/assert.ts";

const entry = (path: string, x: string, y: string): GitEntry => new GitEntry(path, x, y, "");

eq("untracked", markOf(entry("a", "?", "?")), "U");
eq("modified in the work tree", markOf(entry("a", " ", "M")), "M");
eq("modified in the index", markOf(entry("a", "M", " ")), "M");
eq("added", markOf(entry("a", "A", " ")) + markOf(entry("a", "A", "M")), "AA");
eq("deleted", markOf(entry("a", " ", "D")) + markOf(entry("a", "D", " ")), "DD");
eq("renamed", markOf(entry("a", "R", " ")), "R");
eq("conflicted", markOf(entry("a", "U", "U")), "!");

const root = buildTree(["z.txt", "src/b.ts", "src/a.ts", "src/lib/c.ts", "a.md", "src/b.ts"]);
const marks = marksOf([entry("src/lib/c.ts", " ", "M"), entry("a.md", "?", "?")]);
const show = (open: Set<string>): string =>
  visibleRows(root, open, marks, false)
    .map((r) => "  ".repeat(r.depth) + r.name + (r.dir ? (r.open ? "/-" : "/+") : "") + (r.mark.length > 0 ? " " + r.mark : ""))
    .join("|");
eq("closed: directories first, sorted, a dot on a changed one", show(new Set<string>()), "src/+ •|a.md U|z.txt");
eq("one open", show(new Set<string>(["src"])), "src/- •|  lib/+ •|  a.ts|  b.ts|a.md U|z.txt");
eq("both open", show(new Set<string>(["src", "src/lib"])), "src/- •|  lib/- •|    c.ts M|  a.ts|  b.ts|a.md U|z.txt");

const root2 = buildTree(["src/a.ts", "src/lib/c.ts", "docs/x.md", "gone.ts"]);
const marks2 = marksOf([entry("src/lib/c.ts", " ", "M"), entry("gone.ts", "D", " ")]);
const only = visibleRows(root2, new Set<string>(), marks2, true);
eq("changed only: marked files and the folders that lead to them", only.map((r) => r.path + (r.dir && r.open ? "/" : "")).join(","), "src/,src/lib/,src/lib/c.ts,gone.ts");

const dirs: string[] = [];
for (const d of changedDirs(new Map<string, string>([["a/b/c.ts", "M"], ["a/d.ts", "U"], ["e.ts", "M"]]))) dirs.push(d);
dirs.sort();
eq("changed directories", dirs.join(","), "a,a/b");
eq("ancestors", ancestors("a/b/c.ts").join(",") + "|" + ancestors("c.ts").join(","), "a,a/b|");
done();
