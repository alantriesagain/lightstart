import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { modelBus } from "./config.ts";
import { compileMatcher } from "./query-builder.ts";
import { loadRelationships, loadRelationshipsForMany } from "./relationship-loader.ts";

const events = modelBus();

const makeAdapter = (data) => ({
  async getAll(model, options) {
    const rows = (data[model] || []).filter(compileMatcher(options?.where));
    return options?.limit ? rows.slice(0, options.limit) : rows;
  },
  async get(model, id) {
    return (data[model] || []).find((r) => String(r.id) === String(id)) || null;
  },
});

describe("Relationship Loader", () => {
  describe("loadRelationship (belongs_many)", () => {
    const models = {
      post: { tags: { relationship: "belongs_many", targetModel: "tag" } },
    };

    it("should match ids via Set regardless of string/number typing", async () => {
      const adapter = makeAdapter({
        tag: [
          { id: 1, name: "node" },
          { id: 2, name: "web" },
          { id: 3, name: "css" },
        ],
      });
      const record = { id: "p1", tags: ["1", 3] };
      const result = await loadRelationships(adapter, models, "post", record, ["tags"]);
      assert.equal(result.tags.length, 2);
      const names = result.tags.map((t) => t.name).sort();
      assert.deepEqual(names, ["css", "node"]);
    });

    it("should return [] for empty foreign-key arrays", async () => {
      const adapter = makeAdapter({ tag: [{ id: 1, name: "a" }] });
      const record = { id: "p1", tags: [] };
      const result = await loadRelationships(adapter, models, "post", record, ["tags"]);
      assert.deepEqual(result.tags, []);
    });

    it("should return [] when foreignKey is not an array", async () => {
      const adapter = makeAdapter({ tag: [{ id: 1, name: "a" }] });
      const record = { id: "p1", tags: null };
      const result = await loadRelationships(adapter, models, "post", record, ["tags"]);
      assert.deepEqual(result.tags, []);
    });
  });

  describe("loadRelationshipsForMany (polymorphic belongs)", () => {
    const models = {
      comment: {
        target: { relationship: "belongs", polymorphic: true },
      },
      post: {},
      image: {},
    };

    it("should attach polymorphic records across two types", async () => {
      const adapter = makeAdapter({
        post: [
          { id: "p1", title: "First post" },
          { id: "p2", title: "Second post" },
        ],
        image: [{ id: "i1", url: "/a.png" }],
      });
      const comments = [
        { id: "c1", target: "p1", targetType: "post" },
        { id: "c2", target: "i1", targetType: "image" },
        { id: "c3", target: "p2", targetType: "post" },
      ];
      const result = await loadRelationshipsForMany(adapter, models, "comment", comments, ["target"]);
      assert.equal(result[0].target.title, "First post");
      assert.equal(result[1].target.url, "/a.png");
      assert.equal(result[2].target.title, "Second post");
      assert.equal("_modelName" in result[0].target, false);
    });

    it("should handle mixed numeric/string foreign keys consistently", async () => {
      const adapter = makeAdapter({
        post: [{ id: 1, title: "Numeric id" }],
      });
      const comments = [{ id: "c1", target: "1", targetType: "post" }];
      const result = await loadRelationshipsForMany(adapter, models, "comment", comments, ["target"]);
      assert.equal(result[0].target.title, "Numeric id");
    });

    it("should null out polymorphic field when target missing", async () => {
      const adapter = makeAdapter({ post: [] });
      const comments = [{ id: "c1", target: "ghost", targetType: "post" }];
      const result = await loadRelationshipsForMany(adapter, models, "comment", comments, ["target"]);
      assert.equal(result[0].target, null);
    });
  });

  describe("loadRelationship (many / one / foreign keys)", () => {
    const models = {
      account: { transactions: { relationship: "many", targetModel: "transaction", targetForeignKey: "accountId", many: true } },
      user: {
        posts: { relationship: "many", targetModel: "post", many: true },
        profile: { relationship: "one", targetModel: "profile" },
        avatar: { relationship: "belongs", targetModel: "image", belongs: true },
        comments: { relationship: "many", targetModel: "comment", many: true, as: "subject" },
      },
      transaction: {}, post: {}, profile: {}, image: {}, comment: {},
    };
    const adapter = makeAdapter({
      transaction: [{ id: "t1", accountId: "a1" }, { id: "t2", accountId: "a2" }],
      post: [{ id: "p1", userId: "u1" }, { id: "p2", userId: "u2" }],
      profile: [{ id: "pr1", userId: "u1" }],
      image: [{ id: "i1" }],
      comment: [{ id: "c1", subject: "u1", subjectType: "user" }, { id: "c2", subject: "u1", subjectType: "post" }],
    });

    it("uses the declared foreign key, else <model>Id", async () => {
      const account = await loadRelationships(adapter, models, "account", { id: "a1" }, ["transactions"]);
      assert.deepEqual(account.transactions.map((t) => t.id), ["t1"]);
      const user = await loadRelationships(adapter, models, "user", { id: "u1" }, ["posts"]);
      assert.deepEqual(user.posts.map((p) => p.id), ["p1"]);
    });

    it("one answers the first match or null", async () => {
      const u1 = await loadRelationships(adapter, models, "user", { id: "u1" }, ["profile"]);
      assert.equal(u1.profile.id, "pr1");
      const u2 = await loadRelationships(adapter, models, "user", { id: "u2" }, ["profile"]);
      assert.equal(u2.profile, null);
    });

    it("a polymorphic many filters by the as column and its type", async () => {
      const user = await loadRelationships(adapter, models, "user", { id: "u1" }, ["comments"]);
      assert.deepEqual(user.comments.map((c) => c.id), ["c1"]);
    });

    it("a belongs already holding a loaded row reloads through its id", async () => {
      const user = await loadRelationships(adapter, models, "user", { id: "u1", avatar: { id: "i1", stale: true } }, ["avatar"]);
      assert.deepEqual(user.avatar, { id: "i1" });
    });

    it("a dotted include is not a relation and leaves the record untouched", async () => {
      const user = await loadRelationships(adapter, models, "user", { id: "u1" }, ["posts.comments"]);
      assert.equal("posts.comments" in user, false);
    });
  });
});
