import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { applyQueryHooks, clearQueryHooks, registerQueryHook } from "./query-hooks.ts";

const ctx = (opts) => ({ model: "posts", schema: { $i18n: true }, opts, $APP: /** @type {any} */ ({}) });

beforeEach(() => clearQueryHooks());

test("without hooks the options pass through untouched", () => {
  const opts = { limit: 1 };
  assert.equal(applyQueryHooks(ctx(opts)), opts);
});

test("hooks run in registration order, each seeing the previous answer; nothing keeps the options", () => {
  const seen = [];
  registerQueryHook(({ opts }) => { seen.push(opts); return { ...opts, where: { a: 1 } }; });
  registerQueryHook(({ opts }) => { seen.push(opts); });
  registerQueryHook(({ opts, model, schema }) => ({ ...opts, where: { ...opts.where, b: model, c: schema.$i18n } }));
  assert.deepEqual(applyQueryHooks(ctx({ limit: 3 })), { limit: 3, where: { a: 1, b: "posts", c: true } });
  assert.deepEqual(seen, [{ limit: 3 }, { limit: 3, where: { a: 1 } }]);
});

test("the returned function unregisters the hook", () => {
  const off = registerQueryHook(({ opts }) => ({ ...opts, hooked: true }));
  assert.deepEqual(applyQueryHooks(ctx({})), { hooked: true });
  off();
  assert.deepEqual(applyQueryHooks(ctx({})), {});
});
