// node-only
/**
 * @file JSON records, per-locale translation overlays and private fields: `collect` reads both
 * file kinds, `collectLocales` lays a translation over the model's `$localized` fields, and a
 * duplicate slug, a translation with no record and an unknown `$private` field each throw.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok, throws } from "@lightstart/test/assert.ts";
import T from "@lightstart/light/types";
import type { ModelSchema } from "@lightstart/light/model/types.ts";
import { collect, collectLocales } from "../collect.ts";

const model = {
  $localized: ["title"],
  $private: ["secret"],
  title: T.string({ required: true }),
  secret: T.string(),
  body: T.array(),
} as unknown as ModelSchema;

const rowOf = (rows: Record<string, unknown>[], slug: string): Record<string, unknown> | undefined => rows.find((row) => row["slug"] === slug);

const main = (): void => {
  const dir = mkdtempSync(join(tmpdir(), "light-content-records-"));
  try {
    writeFileSync(join(dir, "one.json"), JSON.stringify({ title: "One", secret: "one secret", body: [] }));
    writeFileSync(join(dir, "one.pt.json"), JSON.stringify({ locale: "pt", sourceUpdatedAt: "2026-01-01T00:00:00Z", title: "Um", secret: "translated secret", other: "ignored" }));
    writeFileSync(join(dir, "two.md"), "---\ntitle: Two\nsecret: two secret\n---\n\n# Two\n");
    writeFileSync(join(dir, "two.pt.md"), "---\ntitle: Dois\nsecret: outro segredo\nother: ignored\n---\n");
    writeFileSync(join(dir, "three.json"), JSON.stringify({ title: "Three", secret: "three secret" }));

    const rows = collect(dir, { model });
    eq("a JSON record and a Markdown record are both rows", String(rows.length), "3");
    eq("a JSON record keeps its fields", String(rowOf(rows, "one")?.["title"]), "One");
    ok("a Markdown record still has a body", Array.isArray(rowOf(rows, "two")?.["body"]));
    ok("the private field is left out of every row", rows.every((row) => row["secret"] === undefined));
    eq("the default rows keep the record's own title", String(rowOf(rows, "one")?.["title"]), "One");

    const locales = collectLocales(dir, { model });
    const portuguese = locales.get("pt") ?? [];
    eq("the translation overlay reads the localized field", String(rowOf(portuguese, "one")?.["title"]), "Um");
    eq("a translation's other fields are ignored", String(rowOf(portuguese, "one")?.["other"]), "undefined");
    ok("a translation's private field is left out", rowOf(portuguese, "one")?.["secret"] === undefined);
    eq("a Markdown translation overlays too", String(rowOf(portuguese, "two")?.["title"]), "Dois");
    eq("a record without a translation keeps its default", String(rowOf(portuguese, "three")?.["title"]), "Three");
    eq("the overlay keeps every record", String(portuguese.length), "3");

    writeFileSync(join(dir, "one.md"), "---\ntitle: Duplicate\n---\n");
    throws("the same slug in two files names both", () => collect(dir, { model }), 'slug "one" is in both "one.json" and "one.md"');
    rmSync(join(dir, "one.md"));

    writeFileSync(join(dir, "ghost.pt.json"), JSON.stringify({ title: "Fantasma" }));
    throws("a translation with no record is an error", () => collectLocales(dir, { model }), 'has no record "ghost.md" or "ghost.json"');
    rmSync(join(dir, "ghost.pt.json"));

    const wrong = { ...model, $private: ["missing"] } as unknown as ModelSchema;
    throws("an unknown private field is an error", () => collect(dir, { model: wrong }), '$private names "missing"');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  done();
};

main();
