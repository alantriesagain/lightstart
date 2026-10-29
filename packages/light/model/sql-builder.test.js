import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAddColumnSQL, buildCountSQL, buildCreateIndexSQL, buildCreateTableSQL, buildSelectSQL,
  buildWhereClause, quoteIdent,
} from "./sql-builder.ts";

describe("quoteIdent", () => {
  it("passes a plain column through and quotes one that collides with a keyword", () => {
    assert.equal(quoteIdent("targetSlug"), "targetSlug");
    assert.equal(quoteIdent("order"), '"order"');
  });

  it("refuses anything that is not a bare identifier", () => {
    for (const bad of ["a b", "a;b", "a-b", "1a", "", "a'b", '"a"', "a.b", "a)b"])
      assert.throws(() => quoteIdent(bad), /not a column name/, JSON.stringify(bad));
  });
});

describe("no identifier reaches SQL unchecked", () => {
  it("a where key cannot comment out the clause that follows it", () => {
    assert.throws(
      () => buildWhereClause({ "targetSlug = 'x' OR 1=1 --": 1, userId: "me" }),
      /not a column name/,
      "this is what made read:owner advisory: the owner filter was ANDed after the injected comment",
    );
  });

  it("a where key cannot smuggle an OR past the owner filter", () => {
    assert.throws(() => buildWhereClause({ "1=1 OR id": "x" }), /not a column name/);
  });

  it("a field cannot be a subquery", () => {
    assert.throws(
      () => buildSelectSQL("rsvp", { fields: ["(SELECT passwordHash FROM users LIMIT 1) AS leak"] }),
      /not a column name/,
    );
  });

  it("an order direction is one of two words, whatever was asked for", () => {
    assert.equal(buildSelectSQL("t", { order: [{ field: "id", direction: "ASC, (SELECT 1)" }] }).sql, "SELECT * FROM t ORDER BY id ASC");
    assert.equal(buildSelectSQL("t", { order: [{ field: "id", direction: "desc" }] }).sql, "SELECT * FROM t ORDER BY id DESC");
    assert.equal(buildSelectSQL("t", { order: [{ field: "id" }] }).sql, "SELECT * FROM t ORDER BY id ASC");
  });

  it("a model name is an identifier too", () => {
    assert.throws(() => buildSelectSQL("rsvp; DROP TABLE users", {}), /not a column name/);
  });
});

describe("an honest query still builds", () => {
  it("binds every value and names every column", () => {
    const q = buildWhereClause({ targetSlug: "x", userId: "me" });
    assert.equal(q.sql, "targetSlug = ? AND userId = ?");
    assert.deepEqual(q.params, ["x", "me"]);
  });

  it("projects, filters, orders and pages", () => {
    const q = buildSelectSQL("rsvp", { fields: ["state"], where: { userId: "me" }, order: [{ field: "created", direction: "DESC" }], limit: 10, offset: 20 });
    assert.equal(q.sql, "SELECT state FROM rsvp WHERE userId = ? ORDER BY created DESC LIMIT ? OFFSET ?");
    assert.deepEqual(q.params, ["me", 10, 20]);
  });

  it("counts with the same where", () => {
    const q = buildCountSQL("rsvp", { where: { userId: "me" } });
    assert.match(q.sql, /^SELECT COUNT/);
    assert.deepEqual(q.params, ["me"]);
  });

  it("keeps the operators it supports", () => {
    assert.equal(buildWhereClause({ n: { ">=": 3 } }).sql, "n >= ?");
    assert.equal(buildWhereClause({ s: { like: "a%" } }).sql.toLowerCase(), "s like ?");
    assert.equal(buildWhereClause({ s: null }).sql, "s IS NULL");
  });

  it("reads -field and a comma list as order", () => {
    assert.equal(buildSelectSQL("t", { order: "-created,title" }).sql, "SELECT * FROM t ORDER BY created DESC, title ASC");
  });

  it("has and has all search a JSON array", () => {
    const any = buildWhereClause({ tags: { has: "x" } });
    assert.equal(any.sql, "EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)");
    assert.deepEqual(any.params, ["x"]);
    const all = buildWhereClause({ tags: { "has all": ["x", "y"] } });
    assert.equal(all.sql, "EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?) AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)");
    assert.deepEqual(all.params, ["x", "y"]);
  });
});

describe("buildCreateIndexSQL: composite indexes", () => {
  it("builds a multi-column unique index, which a per-field flag cannot express", () => {
    const [sql] = buildCreateIndexSQL("oauth_accounts", {}, [
      { fields: ["provider", "providerAccountId"], unique: true },
    ]);
    assert.equal(sql, "CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_accounts_provider_providerAccountId ON oauth_accounts(provider, providerAccountId);");
  });

  it("reads $indexes off an authored schema when no list is passed", () => {
    const sql = buildCreateIndexSQL("t", { $indexes: [{ fields: ["a", "b"] }] });
    assert.deepEqual(sql, ["CREATE INDEX IF NOT EXISTS idx_t_a_b ON t(a, b);"]);
  });

  it("takes a single field as a string", () => {
    const [sql] = buildCreateIndexSQL("t", {}, [{ fields: "email", unique: true, name: "by_email" }]);
    assert.equal(sql, "CREATE UNIQUE INDEX IF NOT EXISTS by_email ON t(email);");
  });

  it("keeps per-field indexes alongside composite ones", () => {
    const sql = buildCreateIndexSQL("t", { userId: { index: true }, $indexes: [{ fields: ["a", "b"] }] });
    assert.equal(sql.length, 2);
    assert.match(sql[0], /idx_t_userId/);
    assert.match(sql[1], /idx_t_a_b/);
  });

  it("rejects an identifier that is not a bare name", () => {
    assert.throws(() => buildCreateIndexSQL("t", {}, [{ fields: ["a); DROP TABLE t; --"] }]));
  });
});

describe("buildCreateTableSQL", () => {
  it("uses a text id, JSON as text and booleans as integers", () => {
    const sql = buildCreateTableSQL("users", {
      name: { $type: "string", required: true },
      tags: { $type: "array" },
      admin: { $type: "boolean", defaultValue: false },
    });
    assert.match(sql, /id TEXT PRIMARY KEY/);
    assert.match(sql, /name TEXT NOT NULL/);
    assert.match(sql, /tags TEXT/);
    assert.match(sql, /admin INTEGER DEFAULT 0/);
  });

  it("uses an integer id for a numeric model id", () => {
    assert.match(buildCreateTableSQL("t", { id: { $type: "number" } }), /id INTEGER PRIMARY KEY/);
  });
});

describe("buildAddColumnSQL: a schema that grew a field", () => {
  const schema = {
    id: { $type: "string" },
    name: { $type: "string" },
    details: { $type: "object", defaultValue: {} },
    karma: { $type: "number", defaultValue: 0 },
    $permissions: { read: "owner" },
  };

  it("names only what the live table is missing", () => {
    const sql = buildAddColumnSQL("users", schema, ["id", "name", "created", "updated"]);
    assert.equal(sql.length, 2);
    assert.match(sql[0], /^ALTER TABLE users ADD COLUMN details TEXT DEFAULT '\{\}';$/);
    assert.match(sql[1], /^ALTER TABLE users ADD COLUMN karma REAL DEFAULT 0;$/);
  });

  it("says nothing about a table that already has everything", () => {
    assert.deepEqual(buildAddColumnSQL("users", schema, ["id", "name", "details", "karma"]), []);
  });

  it("never adds a NOT NULL column, which SQLite refuses on a table with rows", () => {
    const sql = buildAddColumnSQL("t", { slug: { $type: "string", required: true } }, []);
    assert.equal(sql.length, 1);
    assert.equal(sql[0].includes("NOT NULL"), false, "the rows already there have no value for it");
  });

  it("skips the id and the $ keys, which are not columns", () => {
    assert.deepEqual(buildAddColumnSQL("t", { id: { $type: "string" }, $adapter: "d1" }, []), []);
  });
});
