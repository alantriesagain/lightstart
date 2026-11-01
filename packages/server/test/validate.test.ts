/**
 * @file `validate` over light's model field descriptors: each type coerced from a path parameter and
 * the query (a repeated value, a comma list, JSON for an array and an object), required and optional
 * fields, defaults, every failure collected into `fields`, a body that is not an object, a malformed
 * body left to `c.json()`, the typed values read back through `c.get`, a route without `validate`
 * left untouched, unknown query names ignored and unknown body keys kept, and a custom validator and
 * format. Runs under node and natively; the outputs must be identical.
 */
import { App } from "../app.ts";
import { Context } from "../context.ts";
import { Reply, json } from "../reply.ts";
import { bodyOf, request } from "../memory/index.ts";
import { BODY, PARAMS, QUERY, validate, type FieldSchema } from "../validate.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const users: FieldSchema = {
  id: { $type: "number", required: true },
};

const listQuery: FieldSchema = {
  limit: { $type: "number" },
  active: { $type: "boolean" },
  tags: { $type: "array" },
  filter: { $type: "object" },
  name: { $type: "string" },
  page: { $type: "number", defaultValue: 1 },
  note: { $type: "string" },
};

const recordBody: FieldSchema = {
  title: { $type: "string", required: true },
  count: { $type: "number" },
  done: { $type: "boolean", defaultValue: false },
  tags: { $type: "array" },
  meta: { $type: "object" },
};

const show = (name: string, values: Map<string, unknown> | undefined): unknown => {
  if (values === undefined) return "absent";
  if (!values.has(name)) return "missing";
  return values.get(name);
};

const app = new App()
  .get("/users/:id", (c: Context): Reply => json({ id: show("id", c.get(PARAMS)) }), [validate({ params: users })])
  .get("/list", (c: Context): Reply => {
    const query = c.get(QUERY);
    return json({
      limit: show("limit", query),
      active: show("active", query),
      tags: show("tags", query),
      filter: show("filter", query),
      name: show("name", query),
      page: show("page", query),
    });
  }, [validate({ query: listQuery })])
  .post("/records", (c: Context): Reply => {
    const body = c.get(BODY);
    return json({
      title: show("title", body),
      count: show("count", body),
      done: show("done", body),
      tags: show("tags", body),
      meta: show("meta", body),
      extra: show("extra", body),
    });
  }, [validate({ body: recordBody })])
  .get("/plain", (): Reply => json({ params: "absent", body: "absent" }));

const parityFields: import("@lightstart/light/model/types.ts").ModelSchema = {
  name: { $type: "string", attribute: false, persist: true, required: true },
  email: { $type: "string", attribute: false, persist: true, format: "email" },
  age: { $type: "number", attribute: false, persist: true, validator: (value: unknown): boolean => typeof value === "number" && value >= 0 },
  tags: { $type: "array", attribute: false, persist: true },
  meta: { $type: "object", attribute: false, persist: true },
  active: { $type: "boolean", attribute: false, persist: true },
  count: { $type: "number", attribute: false, persist: true },
};

type ParityModels = Record<string, import("@lightstart/light/model/types.ts").ModelSchema>;

type ParityCheck = (
  models: ParityModels,
  model: string,
  row: Record<string, unknown>,
) => { valid: boolean; errors: Record<string, string> };

const loadValidateRow = async (): Promise<ParityCheck | null> => {
  try {
    const { validateRow } = await import("@lightstart/light/model/adapter");
    return (models: ParityModels, model: string, row: Record<string, unknown>): { valid: boolean; errors: Record<string, string> } => validateRow(models, model, row);
  } catch {
    return null;
  }
};

const parity = async (): Promise<void> => {
  if (process.env["LIGHT_PARITY"] !== "1") {
    console.log("ok parity: skipped, run node with LIGHT_PARITY=1 (@lightstart/light is not a devDependency and scriptc cannot call through its ModelSchema)");
    return;
  }
  const validateRow = await loadValidateRow();
  if (validateRow === null) {
    console.log("ok parity: skipped, @lightstart/light/model/adapter is not a devDependency of @lightstart/server");
    return;
  }
  const models: ParityModels = { $input: parityFields };
  const app = new App().post("/row", (): Reply => json({ ok: true }), [validate({ body: parityFields })]);
  const rows: Record<string, unknown>[] = [
    { name: "n", email: "a@b.co", age: 3, tags: [], meta: {}, active: true, count: 2 },
    { name: "n" },
    {},
    { name: "" },
    { name: "n", email: "x" },
    { name: "n", age: -1 },
    { name: "n", tags: "no" },
    { name: "n", meta: "x" },
    { name: "n", count: "3" },
    { name: "n", age: "3" },
    { name: 1 },
    { name: "n", email: null, tags: null },
    { name: "n", active: 1 },
    { name: "n", active: 0 },
    { name: "n", extra: "kept" },
  ];
  let same = true;
  for (const row of rows) {
    const expected = validateRow(models, "$input", row).valid;
    const reply = await request(app, "POST", "/row", { headers: { "content-type": "application/json" }, body: JSON.stringify(row) });
    if ((reply.status === 200) !== expected) {
      same = false;
      console.log("FAIL parity: " + JSON.stringify(row) + " light=" + String(expected) + " server=" + String(reply.status === 200));
    }
  }
  ok("validateRow and validate accept and reject the same rows", same);
};

const main = async (): Promise<void> => {
  const id = await request(app, "GET", "/users/42");
  eqn("a path parameter is a number", id.status, 200);
  eq("and reaches the handler", await bodyOf(id), '{"id":42}');

  const coerced = await request(app, "GET", "/list?limit=10&active=true&tags=a,b&filter=%7B%22x%22%3A1%7D&name=bo");
  eqn("every query type coerces", coerced.status, 200);
  eq("a number, a boolean, a comma list, JSON and a string", await bodyOf(coerced), '{"limit":10,"active":true,"tags":["a","b"],"filter":{"x":1},"name":"bo","page":1}');

  const repeated = await request(app, "GET", "/list?tags=a&tags=b&active=1&tags=c");
  eq("a repeated query value makes an array", await bodyOf(repeated), '{"limit":"missing","active":true,"tags":["a","b","c"],"filter":"missing","name":"missing","page":1}');

  const defaults = await request(app, "GET", "/list");
  eq("an absent optional is missing and a default fills", await bodyOf(defaults), '{"limit":"missing","active":"missing","tags":"missing","filter":"missing","name":"missing","page":1}');

  const failures = await request(app, "GET", "/list?limit=abc&active=maybe&tags=%5B1%2C2&name=ok");
  eqn("several query failures answer 400", failures.status, 400);
  eq("all of them are collected", await bodyOf(failures), '{"error":"invalid request","fields":{"query.limit":"must be a number","query.active":"must be a boolean","query.tags":"must be an array"}}');

  const required = await request(app, "POST", "/records", { headers: { "content-type": "application/json" }, body: "{}" });
  eqn("a missing required body field answers 400", required.status, 400);
  eq("with its field and default applied", await bodyOf(required), '{"error":"invalid request","fields":{"body.title":"is required"}}');

  const body = await request(app, "POST", "/records", {
    headers: { "content-type": "application/json" },
    body: '{"title":"t","count":3,"done":true,"tags":["x"],"meta":{"a":1},"extra":"kept"}',
  });
  eqn("a body validates and coerces", body.status, 200);
  eq("typed values reach the handler and unknown keys are kept", await bodyOf(body), '{"title":"t","count":3,"done":true,"tags":["x"],"meta":{"a":1},"extra":"kept"}');

  const notObject = await request(app, "POST", "/records", { headers: { "content-type": "application/json" }, body: "[1,2]" });
  eqn("a body that is not an object answers 400", notObject.status, 400);
  eq("with a body field", await bodyOf(notObject), '{"error":"invalid request","fields":{"body":"must be an object"}}');

  const malformed = await request(app, "POST", "/records", { headers: { "content-type": "application/json" }, body: "{" });
  eqn("a malformed body is c.json's own 400", malformed.status, 400);
  eq("with its message", await bodyOf(malformed), '{"error":"malformed JSON body"}');

  const both = await request(app, "POST", "/records?limit=abc", {
    headers: { "content-type": "application/json" },
    body: '{"count":"nope"}',
  });
  eqn("the route's own validation runs", both.status, 400);

  const plain = await request(app, "GET", "/plain?limit=abc");
  eqn("a route without validate is unaffected", plain.status, 200);
  eq("and keeps its answer", await bodyOf(plain), '{"params":"absent","body":"absent"}');

  const unknown = await request(app, "GET", "/list?limit=2&extra=anything");
  eq("an unknown query name is ignored", await bodyOf(unknown), '{"limit":2,"active":"missing","tags":"missing","filter":"missing","name":"missing","page":1}');

  const checked = new App()
    .get("/checked", (): Reply => json({ ok: true }), [validate({
      query: {
        age: { $type: "number", validator: (value: unknown): boolean => typeof value === "number" && value >= 0 },
        email: { $type: "string", format: "email" },
      },
    })]);
  const failedValidator = await request(checked, "GET", "/checked?age=-1&email=x");
  eqn("a custom validator and a format answer 400", failedValidator.status, 400);
  eq("with both messages", await bodyOf(failedValidator), '{"error":"invalid request","fields":{"query.age":"age failed custom validation","query.email":"must be a valid email"}}');
  const passed = await request(checked, "GET", "/checked?age=3&email=a%40b.co");
  eqn("and pass when they hold", passed.status, 200);

  const paramsAndQuery = new App()
    .get("/both/:id", (c: Context): Reply => json({ id: show("id", c.get(PARAMS)), limit: show("limit", c.get(QUERY)) }), [validate({ params: users, query: { limit: { $type: "number", required: true } } })]);
  const missingQuery = await request(paramsAndQuery, "GET", "/both/7");
  eqn("params and query validate together", missingQuery.status, 400);
  eq("a failed query field is named", await bodyOf(missingQuery), '{"error":"invalid request","fields":{"query.limit":"is required"}}');
  const together = await request(paramsAndQuery, "GET", "/both/7?limit=2");
  eq("and both reach the handler", await bodyOf(together), '{"id":7,"limit":2}');

  const optionalNull = await request(app, "POST", "/records", { headers: { "content-type": "application/json" }, body: '{"title":"t","count":null}' });
  eqn("an explicit null for an optional field passes", optionalNull.status, 200);
  eq("and is kept", await bodyOf(optionalNull), '{"title":"t","count":null,"done":false,"tags":"missing","meta":"missing","extra":"missing"}');

  await parity();

  done();
};

await main();
