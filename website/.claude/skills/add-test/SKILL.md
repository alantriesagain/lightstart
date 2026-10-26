---
name: add-test
description: Add a unit, browser or e2e test with node:test
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from @bootstrapp/test/skills/add-test.md. Edit the source, then run `bootstrapp types`. -->

# Add a test

One test API everywhere: `node:test` + `node:assert/strict`. The filename routes the file: `*.browser.test.js` runs in Chromium, `tests/e2e/*.e2e.js` runs against the built app, everything else under `node --test`.

## Steps

1. **Pick the layer.** Pure logic goes in `lib/<module>.test.js` (no `$APP`, no DOM); a controller flow goes in `tests/app-<controller>.browser.test.js`; a journey through the built app goes in `tests/e2e/<name>.e2e.js`.
2. **Extract pure logic first.** If the logic under test is tangled into a view, pull it into `lib/` and test that.
3. **Run it**: `node --test lib/<module>.test.js` for a quick loop, `bootstrapp test` for node plus browser, `bootstrapp build --spa && bootstrapp test --e2e` for journeys.

## Unit

```js
import test from "node:test";
import assert from "node:assert/strict";
import { phaseAt } from "./round-clock.js";

test("the last second shows until it is gone", () => {
  assert.equal(phaseAt(PLAN, 10.3).remaining, 180);
});
```

## Browser (the real app in an iframe)

```js
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { bootApp, disposeApp, awaitModule, wipe, until } from "@bootstrapp/test/app.js";

describe("app: history controller", () => {
  let app;
  let history;
  before(async () => {
    app = await bootApp("/");
    history = await awaitModule(app.win, "history");
    await wipe(app.$APP, "session");
  });
  after(async () => {
    await wipe(app.$APP, "session");
    assert.deepEqual(app.errors, []);
    disposeApp(app);
  });
  it("follows the model live", async () => {
    await app.$APP.Model.session.add({ id: "s1", startedAt: new Date().toISOString() });
    await until(() => history.sessions.length === 1);
  });
});
```

Live rows arrive through a model broadcast: wait with `until(...)`, never assert right after the write. Stub audio or network handles on the controller in `before` (`timer._bell = silent()`).

## E2e (the built app)

```js
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { e2e } from "@bootstrapp/test/e2e.js";

let app;
before(async () => { app = await e2e(); });
after(() => app.close());

test("a tab is a SPA transition", async () => {
  await app.goto("/");
  await app.page.click(`lc-bottom-nav a[href="/library"]`);
  await app.page.waitForSelector("docs-library");
  assert.equal(await app.page.evaluate(() => document.querySelectorAll("template-app main > *").length), 1);
  assert.deepEqual(app.errors, []);
});
```

A dialog host has no box of its own: `waitForSelector("lc-alert-dialog[open]", { state: "attached" })`. After a navigation, assert the previous screen left `main`.

## Rules

- An empty suite or a zero-test run fails. New controller means its browser test in the same commit.
- Test names describe the defect they pin, not the function they call.
- `packages/test/README.md` lists the browser shim's limits.
- Reference: `projects/bboxe/tests/`, `examples/centavo/tests/`.
