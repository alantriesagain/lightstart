import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import T from "../types/index.js";
import {
  MODEL_ADD, MODEL_ADD_MANY, MODEL_COUNT, MODEL_EDIT, MODEL_EXISTS, MODEL_FACETS,
  MODEL_GET, MODEL_QUERY, MODEL_REMOVE, MODEL_REMOVE_MANY,
} from "./commands.js";
import { createModel, isModelApi, registerQueryHook } from "./index.js";
import { clearQueryHooks } from "./query-hooks.js";

const setup = () => {
  const calls = [];
  const answers = [];
  const models = { account: { name: T.string(), $i18n: true } };
  const Model = createModel(async (...call) => {
    calls.push(call);
    return answers.length ? answers.shift() : null;
  }, { schemaOf: (name) => models[name] });
  return { Model, calls, answers };
};

afterEach(() => clearQueryHooks());

describe("model registry", () => {
  it("every method sends its command with the payload the worker expects", async () => {
    const { Model, calls, answers } = setup();
    answers.push({ id: "a" }, null, { rows: [], total: 0 }, { rows: [], total: 0 }, 1, true, {}, { id: "n" }, [], { id: "e" }, { id: "e" }, true, 1);
    await Model.account.get("a", { includes: ["x"] });
    await Model.account.get({ where: { name: "x" } });
    await Model.account.getAll({ where: { name: "x" } });
    await Model.account.query({ limit: 2, offset: 4 });
    await Model.account.count({ where: {} });
    await Model.account.exists({ name: "x" });
    await Model.account.facets(["kind"]);
    await Model.account.add({ name: "n" });
    await Model.account.addMany([{ name: "m" }]);
    await Model.account.edit("e", { name: "z" });
    await Model.account.edit({ id: "e", name: "z" });
    await Model.account.remove("a");
    await Model.account.removeAll({ name: "x" });
    assert.deepEqual(calls, [
      [MODEL_GET, "account", { id: "a", opts: { includes: ["x"] } }],
      [MODEL_GET, "account", { opts: { where: { name: "x" } } }],
      [MODEL_QUERY, "account", { opts: { where: { name: "x" }, total: false } }],
      [MODEL_QUERY, "account", { opts: { limit: 2, offset: 4 } }],
      [MODEL_COUNT, "account", { opts: { where: {} } }],
      [MODEL_EXISTS, "account", { where: { name: "x" } }],
      [MODEL_FACETS, "account", { fields: ["kind"], opts: {} }],
      [MODEL_ADD, "account", { row: { name: "n" } }],
      [MODEL_ADD_MANY, "account", { rows: [{ name: "m" }] }],
      [MODEL_EDIT, "account", { id: "e", patch: { name: "z" } }],
      [MODEL_EDIT, "account", { id: "e", patch: { id: "e", name: "z" } }],
      [MODEL_REMOVE, "account", { id: "a" }],
      [MODEL_REMOVE_MANY, "account", { where: { name: "x" } }],
    ]);
  });

  it("write options ride beside the payload, and only when given", async () => {
    const { Model, calls, answers } = setup();
    answers.push({ id: "n" }, [], { id: "e" }, { id: "e" }, true);
    await Model.account.add({ name: "n" }, { direct: true });
    await Model.account.addMany([{ name: "m" }], { direct: true });
    await Model.account.edit("e", { name: "z" }, { direct: true });
    await Model.account.edit({ id: "e", name: "z" }, { direct: true });
    await Model.account.remove("a", { direct: true });
    assert.deepEqual(calls, [
      [MODEL_ADD, "account", { row: { name: "n" }, opts: { direct: true } }],
      [MODEL_ADD_MANY, "account", { rows: [{ name: "m" }], opts: { direct: true } }],
      [MODEL_EDIT, "account", { id: "e", patch: { name: "z" }, opts: { direct: true } }],
      [MODEL_EDIT, "account", { id: "e", patch: { id: "e", name: "z" }, opts: { direct: true } }],
      [MODEL_REMOVE, "account", { id: "a", opts: { direct: true } }],
    ]);
  });

  it("getAll unwraps the page, query keeps it, writes answer the row and reject on failure", async () => {
    const { Model, answers } = setup();
    answers.push({ rows: [{ id: "a" }], total: 7 }, { rows: [{ id: "a" }], total: 7 }, { id: "n", name: "n" });
    assert.deepEqual(await Model.account.getAll(), [{ id: "a" }]);
    assert.deepEqual(await Model.account.query({ limit: 1 }), { rows: [{ id: "a" }], total: 7 });
    assert.deepEqual(await Model.account.add({ name: "n" }), { id: "n", name: "n" });
    const failing = createModel(async () => { throw Object.assign(new Error("nope"), { errors: { name: "x" } }); });
    await assert.rejects(failing.account.add({}), (error) => error.message === "nope" && error.errors.name === "x");
  });

  it("the same api answers on every read, is branded, and ext() prefixes the model name", () => {
    const { Model } = setup();
    assert.equal(Model.account, Model.account);
    assert.equal(Model.account.name, "account");
    assert.equal(isModelApi(Model.account), true);
    assert.equal(isModelApi({ name: "account" }), false);
    assert.equal(Model.ext("delivery").scripts, Model.delivery_scripts);
    assert.equal(Model.ext("delivery").extensionId, "delivery");
    assert.throws(() => Model.ext(""), /extensionId/);
  });

  it("query hooks shape getAll, query and count with the model's schema in hand", async () => {
    const { Model, calls, answers } = setup();
    registerQueryHook(({ schema, opts }) => (schema?.$i18n ? { ...opts, where: { ...opts.where, locale: "pt" } } : undefined));
    answers.push({ rows: [], total: 0 }, { rows: [], total: 0 }, 0);
    await Model.account.getAll({ where: { a: 1 } });
    await Model.account.query({});
    await Model.account.count({});
    assert.deepEqual(calls.map(([, , payload]) => payload.opts.where), [{ a: 1, locale: "pt" }, { locale: "pt" }, { locale: "pt" }]);
  });
});
