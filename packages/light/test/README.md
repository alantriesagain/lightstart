# Testing with light

One test API, node's. A test file is written against `node:test` and `node:assert/strict`, and runs under `node --test` when it needs no DOM, or in a real browser when it does. In the browser those two specifiers resolve, through the runner page's importmap, to the modules in this folder: an implementation of `node:test` and `node:assert` for the browser.

A component module registers its own tag with `View.define`, so a test imports it and uses the tag:

```js
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./counter.js";

describe("my-counter", () => {
  it("counts", async () => {
    const el = document.createElement("my-counter");
    document.body.append(el);
    el.querySelector("button").click();
    await el.$requestUpdate();
    assert.equal(el.count, 1);
    el.remove();
  });
});
```

## Running

```bash
npx light test counter.browser.test.js another.browser.test.js   # headless Chromium
npx light test --headed counter.browser.test.js                  # watch it
```

`light test` runs exactly the files it is given, in headless Chromium through [Playwright](https://playwright.dev) (`npm i -D playwright && npx playwright install chromium`). It serves the current package folder on a free port, builds an importmap from the package's `exports` and those of the packages it declares, opens one page per file and reports what each registered. Which files run, and which of them need a browser, is the caller's business: a `test` script in `package.json` names them. A file that registers no tests fails, as does a run with no tests at all.

| Flag | Meaning |
|---|---|
| `--headed` | A visible browser |
| `--timeout <ms>` | How long one file may take (default 420000) |
| `--root <dir>` | The folder to serve (default: the current directory) |

For a setup of your own, the pieces are exported: `runFiles` (`test/run.js`) is the loop, `serve` (`test/serve.js`) the static server with the runner page, `runnerPage` (`test/page.js`) the page itself. A host that serves its own pages passes `runFiles` the URL of its runner for each file; the page imports `harness.js` and `report.js`, runs the file and publishes a `WireRun` on `window.testResults`.

## What `node:test` covers here

`test`/`it`, `describe`/`suite`, their `.skip`, `.todo` and `.only`, `before`/`after`/`beforeEach`/`afterEach`, the options `skip`, `todo`, `only`, `timeout` (on a test) `plan` and `concurrency`, and the test context: `name`, `fullName`, `signal`, `mock`, `diagnostic`, `skip`, `todo`, `plan`, `before` (once before the first subtest), `after`, `t.test` subtests and `t.assert` (which counts toward `plan`). `mock.fn`, `mock.method`, `mock.getter`, `mock.setter`, `mock.reset` and `mock.restoreAll` answer the node shapes (`calls[i].arguments`, `callCount`, `mockImplementation`, `mockImplementationOnce`, `resetCalls`). `node:assert` and `node:assert/strict` are both here.

What is not here throws, naming the member, so nothing passes by accident: `run()`, snapshots (`snapshot.*`, `t.assert.snapshot`), `t.beforeEach`/`t.afterEach`, `mock.timers`, `mock.module`, and a `timeout` option on a hook or a suite. There are no reporters and no coverage. `.only` is always honoured. A `describe` body that returns a promise is an error; async setup belongs in `before`.

Two deliberate differences from node: `deepEqual` compares constructor names rather than identities, so a value built in an iframe compares equal to its main-realm twin; and assertion messages are not byte-identical to `util.inspect`'s.

## How it is kept honest

`assert.test.js` checks every assertion against node's own; `deep-equal.test.js` checks against `node:util` across two realms; `parity.test.js` runs each `fixtures/*.fixture.js` once under real `node:test` and once under this implementation (`module.register` maps the specifiers) and compares the two result tables. All of that runs under plain `node --test test/*.test.js`.
