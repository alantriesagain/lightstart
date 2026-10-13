import assert from "node:assert/strict";
import test from "node:test";
import { parseControllerSources } from "./controller.js";

test("parseControllerSources reads name, properties, the sync block and members", () => {
  const src = `export default defineController({
  name: "ledger",
  props: {
    month: T.string({ defaultValue: "2026-01" }),
    theme: "",
    current: null,
    look: "light",
    rows: [],
  },
  sync: { theme: "local", look: { to: "local", key: "ledgerLook" }, rows: { to: () => app.Model.rows, query: {} } },
  _table: null,
  limits: { max: 3 },
  helper,
  connected() {},
  refresh: async () => {},
});
`;
  const [parsed] = parseControllerSources(src, "controllers/ledger.js");
  assert.equal(parsed.name, "ledger");
  assert.equal(parsed.offset, src.indexOf("defineController"));
  assert.deepEqual(parsed.propertyNames.map((p) => [p.name, p.hasNonNullDefault, p.sync]), [
    ["month", true, null],
    ["theme", true, "local"],
    ["current", false, null],
    ["look", true, "local"],
    ["rows", true, null],
  ]);
  assert.deepEqual(parsed.syncEntries.map((e) => [e.prop, e.target, e.key, e.targetText]), [
    ["theme", "local", null, '"local"'],
    ["look", "local", "ledgerLook", '"local"'],
    ["rows", null, null, "() => app.Model.rows"],
  ]);
  assert.deepEqual(parsed.memberNames.map((m) => [m.name, m.kind]), [["_table", "value"], ["limits", "value"], ["helper", "shorthand"], ["connected", "method"], ["refresh", "method"]]);
  assert.ok(parsed.literal && parsed.sf);
});

test("every defineController call is a controller, wherever it stands, and a definition through a local const counts", () => {
  const src = `const def = { name: "two", props: { b: 0 } };
export const one = defineController({ name: "one", props: { a: 0 } });
const two = defineController(def);
function make() { return defineController({ name: "three" }); }
`;
  assert.deepEqual(parseControllerSources(src, "lib/stores.js").map((c) => c.name), ["one", "two", "three"]);
});

test("anything but a defineController call with a literal is no controller", () => {
  assert.deepEqual(parseControllerSources('export default { name: "plain" };', "c.js"), []);
  assert.deepEqual(parseControllerSources("export default other({ name: 'x' });", "c.js"), []);
  assert.deepEqual(parseControllerSources("export default defineController(makeDefinition());", "c.js"), []);
});
