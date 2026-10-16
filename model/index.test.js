import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import T from "../types/index.js";
import {
  MODEL_ADD, MODEL_ADD_MANY, MODEL_COUNT, MODEL_EDIT, MODEL_EXISTS, MODEL_FACETS,
  MODEL_GET, MODEL_QUERY, MODEL_REMOVE, MODEL_REMOVE_MANY,
} from "./commands.js";
import { configureModel, defineModel, isModelApi, modelApi, registerQueryHook } from "./index.js";
import { clearQueryHooks } from "./query-hooks.js";

const setup = () => {
  const calls = [];
  const answers = [];
  configureModel({
    request: async (...call) => {
      calls.push(call);
      return answers.length ? answers.shift() : null;
    },
  });
  const account = defineModel("account", { name: T.string(), $i18n: true });
  return { account, calls, answers };
};

afterEach(() => {
  clearQueryHooks();
  configureModel();
});

describe("a model's api", () => {
  it("every method sends its command with the payload the worker expects", async () => {
    const { account, calls, answers } = setup();
    answers.push({ id: "a" }, null, { rows: [], total: 0 }, { rows: [], total: 0 }, 1, true, {}, { id: "n" }, [], { id: "e" }, { id: "e" }, true, 1);
    await account.get("a", { includes: ["x"] });
    await account.get({ where: { name: "x" } });
    await account.getAll({ where: { name: "x" } });
    await account.query({ limit: 2, offset: 4 });
    await account.count({ where: {} });
    await account.exists({ name: "x" });
    await account.facets(["kind"]);
    await account.add({ name: "n" });
    await account.addMany([{ name: "m" }]);
    await account.edit("e", { name: "z" });
    await account.edit({ id: "e", name: "z" });
    await account.remove("a");
    await account.removeAll({ name: "x" });
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
    const { account, calls, answers } = setup();
    answers.push({ id: "n" }, [], { id: "e" }, { id: "e" }, true);
    await account.add({ name: "n" }, { direct: true });
    await account.addMany([{ name: "m" }], { direct: true });
    await account.edit("e", { name: "z" }, { direct: true });
    await account.edit({ id: "e", name: "z" }, { direct: true });
    await account.remove("a", { direct: true });
    assert.deepEqual(calls, [
      [MODEL_ADD, "account", { row: { name: "n" }, opts: { direct: true } }],
      [MODEL_ADD_MANY, "account", { rows: [{ name: "m" }], opts: { direct: true } }],
      [MODEL_EDIT, "account", { id: "e", patch: { name: "z" }, opts: { direct: true } }],
      [MODEL_EDIT, "account", { id: "e", patch: { id: "e", name: "z" }, opts: { direct: true } }],
      [MODEL_REMOVE, "account", { id: "a", opts: { direct: true } }],
    ]);
  });

  it("getAll unwraps the page, query keeps it, writes answer the row and reject on failure", async () => {
    const { account, answers } = setup();
    answers.push({ rows: [{ id: "a" }], total: 7 }, { rows: [{ id: "a" }], total: 7 }, { id: "n", name: "n" });
    assert.deepEqual(await account.getAll(), [{ id: "a" }]);
    assert.deepEqual(await account.query({ limit: 1 }), { rows: [{ id: "a" }], total: 7 });
    assert.deepEqual(await account.add({ name: "n" }), { id: "n", name: "n" });
    configureModel({ request: async () => { throw Object.assign(new Error("nope"), { errors: { name: "x" } }); } });
    await assert.rejects(account.add({}), (error) => error.message === "nope" && error.errors.name === "x");
  });

  it("is branded, carries its name and schema, and sends through the request configured when the call is made", async () => {
    const { account, calls } = setup();
    assert.equal(account.name, "account");
    assert.equal(account.schema.$i18n, true);
    assert.equal(isModelApi(account), true);
    assert.equal(isModelApi({ name: "account" }), false);
    const later = [];
    configureModel({ request: async (...call) => { later.push(call); return 0; } });
    await account.count({});
    assert.equal(calls.length, 0);
    assert.deepEqual(later, [[MODEL_COUNT, "account", { opts: {} }]]);
  });

  it("modelApi reads its schema when asked, so a schema registered later is found", () => {
    const schemas = {};
    const api = modelApi("late", () => schemas.late);
    assert.equal(api.schema, undefined);
    schemas.late = { title: T.string() };
    assert.equal(api.schema, schemas.late);
  });

  it("rejects naming configureModel while no request is configured", async () => {
    configureModel();
    const account = defineModel("account", { name: T.string() });
    await assert.rejects(account.count({}), /Model "account": MODEL:COUNT has no request to go through; call configureModel\(\{ request \}\)/);
  });

  it("query hooks shape getAll, query and count with the model's schema in hand", async () => {
    const { account, calls, answers } = setup();
    registerQueryHook(({ schema, opts }) => (schema?.$i18n ? { ...opts, where: { ...opts.where, locale: "pt" } } : undefined));
    answers.push({ rows: [], total: 0 }, { rows: [], total: 0 }, 0);
    await account.getAll({ where: { a: 1 } });
    await account.query({});
    await account.count({});
    assert.deepEqual(calls.map(([, , payload]) => payload.opts.where), [{ a: 1, locale: "pt" }, { locale: "pt" }, { locale: "pt" }]);
  });
});
