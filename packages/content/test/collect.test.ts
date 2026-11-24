// node-only
/**
 * @file A folder of Markdown files as rows: the file name fills `slug`, the frontmatter keeps
 * its fields, the body is JSON, and a schema rejection names the file and the field.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok, throws } from "@lightstart/test/assert.ts";
import T from "@lightstart/light/types";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { collect } from "../collect.ts";

const dir = mkdtempSync(join(tmpdir(), "light-content-collect-"));
try {
  writeFileSync(join(dir, "first.md"), "---\ntitle: First\ndate: 2024-01-02\ntags: [a, b]\n---\n\n# Hi\n");
  writeFileSync(join(dir, "second.md"), "---\ntitle: Second\nslug: chosen\n---\nText\n");
  const model = { title: T.string({ required: true }), date: T.string(), tags: T.array() } as unknown as ModelSchema;

  const rows = collect(dir, { model });
  eq("the files are read in name order", rows.map((row) => String(row["slug"])).join(","), "first,chosen");
  eq("a frontmatter field is kept", String(rows[0]?.["title"]), "First");
  ok("a body is a block list", Array.isArray(rows[0]?.["body"]) && (rows[0]?.["body"] as unknown[]).length === 1);
  eq("the body's first block", JSON.stringify((rows[0]?.["body"] as { type?: string }[])[0]?.type), '"heading"');
  eq("an inline frontmatter list is kept", JSON.stringify(rows[0]?.["tags"]), '["a","b"]');
  eq("a frontmatter slug wins over the file name", String(rows[1]?.["slug"]), "chosen");

  writeFileSync(join(dir, "broken.md"), "---\nslug: broken\n---\nText\n");
  throws("a schema rejection names the file and the field", () => collect(dir, { model }), 'broken.md: field "title"');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const idDir = mkdtempSync(join(tmpdir(), "light-content-id-"));
try {
  writeFileSync(join(idDir, "markdown.md"), "---\ntitle: Markdown\n---\nText\n");
  writeFileSync(join(idDir, "json.json"), '{"title":"Json"}\n');
  writeFileSync(join(idDir, "own.md"), "---\nid: custom\ntitle: Own\n---\nText\n");
  const model = { id: T.string({ required: true }), title: T.string({ required: true }) } as unknown as ModelSchema;

  const rows = collect(idDir, { model });
  eq("a slug fills a required id in json", String(rows[0]?.["id"]), "json");
  eq("a slug fills a required id in markdown", String(rows[1]?.["id"]), "markdown");
  eq("a record with its own id keeps it", String(rows[2]?.["id"]), "custom");
} finally {
  rmSync(idDir, { recursive: true, force: true });
}
done();
