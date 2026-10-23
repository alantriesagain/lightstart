import assert from "node:assert/strict";
import test from "node:test";
import { runRuleOn } from "../test-utils.js";
import rule from "./controller-state-key-declared.js";

const files = {
  "controllers/history.js": `import { defineController } from "@bootstrapp/light/controller";
import T from "@bootstrapp/light/types";
import { extra } from "./history/extra.js";
export default defineController({ name: "history", mixins: [extra], props: { rows: T.array({ defaultValue: [] }), mood: T.string({ defaultValue: "" }) } });
`,
  "controllers/history/extra.js": `import { defineMixin } from "@bootstrapp/light/controller";
import T from "@bootstrapp/light/types";
export const extra = defineMixin({ props: { paletteOpen: T.boolean({ defaultValue: false }) } });
`,
};

test("a binding or subscription to a key the controller does not declare fires", async () => {
  const findings = await runRuleOn(rule, {
    ...files,
    "views/home.js": `import $APP from "bootstrapp";
import T from "@bootstrapp/light/types";
export default {
  tag: "fx-home",
  props: {
    rows: T.array({ defaultValue: [], sync: "history" }),
    gone: T.array({ defaultValue: [], sync: "history" }),
    open: T.boolean({ defaultValue: false, sync: "history", key: "paletteOpen" }),
    feeling: T.string({ defaultValue: "", sync: "history", key: "mood" }),
    theme: T.string({ defaultValue: "", sync: "local" }),
  },
  connected() {
    this.$own($APP.history.$state.subscribe("rows", () => {}));
    this.$own($APP.history.$state.subscribe("vanished", () => {}));
    this.$own($APP.unknown.$state.subscribe("x", () => {}));
    const { history } = $APP;
    this.$own(history.$state.subscribe(
      "departed",
      () => {},
    ));
    this.$own(history.$state.subscribe("mood", () => {}));
  },
};
`,
  });
  assert.equal(findings.length, 3);
  assert.match(findings[0].message, /declares no property "vanished"/);
  assert.match(findings[1].message, /declares no property "departed"/);
  assert.match(findings[2].message, /binds "gone"/);
});

test("a controller that spreads into its properties block is skipped, since its surface is not readable here", async () => {
  const findings = await runRuleOn(rule, {
    "controllers/profile.js": `import { defineController } from "@bootstrapp/light/controller";
import T from "@bootstrapp/light/types";
const shape = () => ({ level: T.string({ defaultValue: "" }) });
export default defineController({ name: "profile", props: { loaded: T.boolean({ defaultValue: false }), ...shape() } });
`,
    "views/home.js": `import T from "@bootstrapp/light/types";
export default { tag: "fx-home", props: { level: T.string({ defaultValue: "", sync: "profile" }) } };
`,
  });
  assert.deepEqual(findings, []);
});

test("a controller's sync block entry is checked like a descriptor, the long form's key included", async () => {
  const findings = await runRuleOn(rule, {
    ...files,
    "controllers/journal.js": `import { defineController } from "@bootstrapp/light/controller";
export default defineController({
  name: "journal",
  props: { rows: [], gone: [], open: false, feeling: "" },
  sync: { rows: "history", gone: "history", open: { to: "history", key: "paletteOpen" }, feeling: { to: "history", key: "moods" } },
});
`,
  });
  assert.deepEqual(findings.map((f) => f.message.match(/binds "(\w+)"/)[1]).sort(), ["gone", "moods"]);
});

test("a dependency's controller, from the host's controller files, is a target like the project's own", async () => {
  const findings = await runRuleOn(rule, {
    "node_modules/@bootstrapp/devices/controllers/devices.js": `import { defineController } from "@bootstrapp/light/controller";
export default defineController({ name: "devices", props: { paired: [] } });
`,
    "views/home.js": `import T from "@bootstrapp/light/types";
export default { tag: "fx-home", props: {
  paired: T.array({ sync: "devices" }),
  gone: T.array({ sync: "devices" }),
} };
`,
  }, { host: { controllerFiles: () => ["node_modules/@bootstrapp/devices/controllers/devices.js"] } });
  assert.deepEqual(findings.map((f) => f.message.match(/binds "(\w+)"/)[1]), ["gone"]);
});
